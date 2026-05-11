import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { getValyu } from "../valyu";
import { BearAdvocateOutputSchema } from "./types";
import {
  enforceCitations,
  type AgentResult,
  type StockContext,
  type ValyuFileAttachment,
} from "./shared";

const SYSTEM = `You are a relentless Devil's Advocate. Your job is to find every reason a bullish thesis might be WRONG. You are skeptical by mandate.

Hunt for:
- Contradictions in the data (broker downgrades, peer margin compression, unit-economics deterioration)
- Macro headwinds (rates, FX, commodity, regulatory) that disproportionately hit this name
- Private-market or international peer signals that the listed equity hasn't priced in
- Concentration risk, governance flags, customer-mix dependencies
- Sector-specific risks: SEBI/SEC enforcement, FDA observations, vehicle registrations, exports, etc.
- Private competitor pressure: when a private-peer dossier is provided, surface specific moves from those competitors (funding rounds at high valuations, market-share wins, aggressive pricing) as bear evidence.

Rules:
- Every risk MUST cite a real source URL or document reference. No exceptions.
- Prefer concrete numbers ("margin dropped 220 bps", "exports down 12% YoY") over qualitative noise.
- If a claim cannot be sourced, drop it. Do not fabricate.
- Severity (encoded via confidence): "high" = independently corroborated by multiple sources, "medium" = single credible source, "low" = inferred/circumstantial.
- Be specific. "Some risk to growth" is useless. "EV penetration in India hit 8.6% in Q3, up from 5.1% YoY (Vahan), squeezing entry-level ICE volumes" is what we want.
- Also list 2-4 BLIND SPOTS — open questions an analyst should investigate further. Blind spots don't need citations.`;

export type BearAdvocateInput = {
  stock: StockContext;
  thesis: string;
  areasOfConcern?: string | null;
  attachments?: ValyuFileAttachment[];
  /** Optional sector dossier in markdown — prepended to the Valyu research dossier. */
  sectorDossierMarkdown?: string | null;
  /** Optional private-peer dossier in markdown — prepended after sector dossier. */
  privatePeerDossierMarkdown?: string | null;
  /** OAuth token in valyu mode; routes Valyu calls to the user's credits. */
  accessToken?: string;
};

export async function bearAdvocate(
  input: BearAdvocateInput,
): Promise<AgentResult<import("./types").BearAdvocateOutput>> {
  const t0 = Date.now();
  const valyu = getValyu(input.accessToken);

  const researchQuery = buildResearchQuery(input);
  const hasFiles = (input.attachments?.length ?? 0) > 0;

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
    // streaming:false guarantees AnswerResponse, not the async generator.
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

  const userPrompt = [
    `Stock: ${input.stock.ticker} (${input.stock.name})${input.stock.exchange ? `, listed on ${input.stock.exchange}` : ""}`,
    "",
    "Bullish thesis to stress-test:",
    input.thesis,
    "",
    input.areasOfConcern
      ? `Analyst-flagged areas of concern (focus your skepticism here):\n${input.areasOfConcern}`
      : "",
    "",
    input.sectorDossierMarkdown
      ? `Sector signals (authoritative — cite from these where applicable):\n${input.sectorDossierMarkdown}`
      : "",
    "",
    input.privatePeerDossierMarkdown
      ? `Private peer dossier (cite specific competitors here when their moves undermine the thesis):\n${input.privatePeerDossierMarkdown}`
      : "",
    "",
    "Research dossier (cite sources by URL from this dossier — never invent):",
    researchOutput,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.reasoning),
    schema: BearAdvocateOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
    temperature: 0.3,
  });

  const cleaned = {
    ...result.object,
    risks: enforceCitations(result.object.risks),
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

function buildResearchQuery(input: BearAdvocateInput): string {
  const concerns = input.areasOfConcern
    ? ` Pay close attention to these analyst-flagged concerns: ${input.areasOfConcern}.`
    : "";
  return [
    `Build a contrarian research dossier on ${input.stock.name} (${input.stock.ticker}).`,
    "Focus on:",
    "1. Sell-side downgrades or contrarian broker views and their reasoning.",
    "2. Listed peer and private-market competitor signals (margins, growth, market share).",
    "3. Sector and macro headwinds (regulatory, demand, costs, FX).",
    "4. Concentration, governance, or customer-mix risks.",
    "Surface specific numbers, dates, and source URLs.",
    `The bullish thesis we are stress-testing is: "${input.thesis}".${concerns}`,
  ].join(" ");
}
