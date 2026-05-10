import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { getValyu } from "../valyu";
import { FundBearAdvocateOutputSchema } from "./types";
import {
  enforceCitations,
  type AgentResult,
  type ValyuFileAttachment,
} from "./shared";
import type {
  FundContext,
  FundHoldingForAgent,
} from "./fund-bull-advocate";

const SYSTEM = `You are a relentless Devil's Advocate for funds. Your job is to find every reason this fund's strategy might fail.

Hunt for:
- Concentration risk: single-name weights >5%, sector tilts >25%, top-10 dominance
- Weak or controversial holdings: governance issues, regulatory actions, peer-margin compression, customer concentration, accounting flags
- Macro / sector headwinds the portfolio is exposed to (rates, FX, commodity, regulatory)
- Style drift, manager turnover, fee compression, redemption pressure
- Look-through risk: are top holdings actually weak operationally? Use the research dossier to flag specific names.

Rules:
- Every risk MUST cite a real source URL or document reference. No exceptions.
- Prefer concrete numbers. "Top-3 weight = 46.5%, vs. category median 28%" beats "concentration risk."
- For weakHoldingsFlags, name the specific ticker(s) and cite the issue from the dossier.
- Confidence: high = independently corroborated by multiple sources, medium = single credible source, low = inferred / circumstantial.
- BLIND SPOTS: 2-4 open questions an analyst should investigate. No citations required.`;

export type FundBearAdvocateInput = {
  fund: FundContext;
  thesis: string;
  areasOfConcern?: string | null;
  holdings: FundHoldingForAgent[];
  attachments?: ValyuFileAttachment[];
};

export async function fundBearAdvocate(
  input: FundBearAdvocateInput,
): Promise<AgentResult<import("./types").FundBearAdvocateOutput>> {
  const t0 = Date.now();
  const valyu = getValyu();
  const hasFiles = (input.attachments?.length ?? 0) > 0;

  const top = input.holdings.slice(0, 10);
  const researchQuery = buildResearchQuery(input, top);

  let researchOutput = "";
  let valyuResponse: unknown;

  if (hasFiles) {
    const task = await valyu.deepresearch.create({
      query: researchQuery,
      mode: "fast",
      outputFormats: ["markdown"],
      files: input.attachments ?? [],
      tools: { code_execution: false, screenshots: false, charts: false },
    });
    if (!task.deepresearch_id) {
      throw new Error("Valyu DeepResearch did not return a task id");
    }
    const taskId = task.deepresearch_id;
    const final = await valyu.deepresearch.wait(taskId);
    valyuResponse = { mode: "deepresearch", task_id: taskId };
    researchOutput =
      typeof final.output === "string"
        ? final.output
        : JSON.stringify(final.output ?? "");
  } else {
    const raw = await valyu.answer(researchQuery, {
      searchType: "all",
      streaming: false,
    });
    const res = raw as Awaited<ReturnType<typeof valyu.answer>> extends infer T
      ? T extends { success: boolean }
        ? T
        : never
      : never;
    valyuResponse = res;
    if ("success" in res && res.success) {
      const summary =
        typeof res.contents === "string"
          ? res.contents
          : JSON.stringify(res.contents ?? "");
      const sourcesBlock = (res.search_results ?? [])
        .map(
          (s, i) =>
            `[${i + 1}] ${s.title}\nURL: ${s.url}${typeof s.content === "string" ? `\n${s.content.slice(0, 1200)}` : ""}`,
        )
        .join("\n---\n");
      researchOutput = `## AI summary\n${summary}\n\n## Sources\n${sourcesBlock}`;
    } else {
      researchOutput = "[Valyu answer call failed]";
    }
  }

  // Compute concentration stats locally — these are deterministic and
  // shouldn't be left to the LLM.
  const top3 = top.slice(0, 3).reduce((s, h) => s + h.weightPct, 0);
  const top10 = top.slice(0, 10).reduce((s, h) => s + h.weightPct, 0);
  const sectorMap = new Map<string, number>();
  for (const h of input.holdings) {
    const k = h.sector?.trim() || "Unclassified";
    sectorMap.set(k, (sectorMap.get(k) ?? 0) + h.weightPct);
  }
  const topSectors = [...sectorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const userPrompt = [
    `Fund: ${input.fund.fundName} (${input.fund.fundType.toUpperCase()})`,
    "",
    "Thesis to stress-test:",
    input.thesis,
    "",
    input.areasOfConcern
      ? `Analyst-flagged areas of concern (focus skepticism here):\n${input.areasOfConcern}`
      : "",
    "",
    "Concentration metrics (computed):",
    `- Top-3 weight: ${top3.toFixed(2)}%`,
    `- Top-10 weight: ${top10.toFixed(2)}%`,
    `- Top sectors: ${topSectors.map(([s, w]) => `${s} ${w.toFixed(1)}%`).join(", ")}`,
    "",
    "Top 10 holdings:",
    ...top.map(
      (h, i) =>
        `${i + 1}. ${h.ticker} — ${h.name} · ${h.weightPct.toFixed(2)}%${h.sector ? ` · ${h.sector}` : ""}`,
    ),
    "",
    "Research dossier (cite by URL from this dossier; do not invent):",
    researchOutput,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.reasoning),
    schema: FundBearAdvocateOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
    temperature: 0.3,
  });

  const cleaned = {
    ...result.object,
    concentrationRisks: enforceCitations(result.object.concentrationRisks),
    weakHoldingsFlags: enforceCitations(result.object.weakHoldingsFlags),
    macroOrSectorRisks: enforceCitations(result.object.macroOrSectorRisks),
  };

  return {
    output: cleaned,
    audit: {
      agentName: "bear_advocate",
      model: MODELS.reasoning,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      valyuResponsesJson: valyuResponse,
      durationMs: Date.now() - t0,
    },
  };
}

function buildResearchQuery(
  input: FundBearAdvocateInput,
  top: FundHoldingForAgent[],
): string {
  const concerns = input.areasOfConcern
    ? ` Analyst-flagged concerns: ${input.areasOfConcern}.`
    : "";
  const holdingsLine = top.map((h) => `${h.name} (${h.ticker})`).join(", ");
  return [
    `Build a contrarian research dossier on the fund "${input.fund.fundName}".`,
    `The fund's bullish thesis is: "${input.thesis}".${concerns}`,
    `Pay particular attention to its top holdings: ${holdingsLine}.`,
    "For each top holding, surface any of: governance flags, regulatory actions, peer downgrades, weak guidance, accounting concerns, customer concentration.",
    "Also flag macro / sector headwinds, manager-strategy drift signals, redemption pressure, fee compression vs. peers.",
    "Cite specific numbers, dates, and source URLs.",
  ].join(" ");
}
