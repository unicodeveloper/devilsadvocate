import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { formatUSD, toUSD } from "../fx";
import { FundSynthesizedMemoSchema } from "./types";
import { enforceCitations, type AgentResult } from "./shared";
import type {
  FundBullAdvocateOutput,
  FundBearAdvocateOutput,
  FundHouseViewCheckerOutput,
} from "./types";
import type {
  FundContext,
  FundHoldingForAgent,
} from "./fund-bull-advocate";

const SYSTEM = `You are the Synthesizer for fund memos. You receive three independent agent outputs (Bull Advocate, Bear Advocate, House View Checker for funds) plus the fund's actual holdings. Produce a single, structured Investment Memo for the CIO.

Sections:
1. Setup — 2-3 sentence overview of the fund and the thesis. Include 4-8 key metrics if discernible (AUM, top-3 weight, top-10 weight, top sector weight, manager, etc.).
2. Portfolio Composition — one-line headline read on portfolio shape (concentrated vs diversified, sector tilts, etc.). Sector tilts table. Per-top-holding commentary (use only what the agents provided; cite when claiming).
3. House View Overlay — copy the rule verdicts EXACTLY as the checker provided them. Headline summarizes overall alignment.
4. Stress-Test (THE CORE) — synthesize the strongest contrarian case from the bear's outputs. Preserve confidence labels and citations EXACTLY. Do not invent. Order by confidence then severity.
5. Final Verdict — constructive / cautious / avoid / inconclusive, with reasoning and a confidence label.

CRITICAL RULES:
- DO NOT invent claims. Every Finding must come from one of the three input agents and retain its original citation(s).
- DO NOT inflate confidence. If the bear marked something "low", keep it "low".
- DO NOT fabricate citation URLs. If a finding has no citation, drop it.
- For top holdings commentary, use only what was supplied — don't make up new claims.`;

export type FundSynthesizerInput = {
  fund: FundContext;
  thesis: string;
  holdings: FundHoldingForAgent[];
  bull: FundBullAdvocateOutput;
  bear: FundBearAdvocateOutput;
  houseView: FundHouseViewCheckerOutput;
};

export async function fundSynthesizer(
  input: FundSynthesizerInput,
): Promise<AgentResult<import("./types").FundSynthesizedMemo>> {
  const t0 = Date.now();

  // Compute portfolio stats deterministically — these belong in the memo.
  const sortedHoldings = [...input.holdings].sort(
    (a, b) => b.weightPct - a.weightPct,
  );
  const top3 = sortedHoldings.slice(0, 3).reduce((s, h) => s + h.weightPct, 0);
  const top10 = sortedHoldings.slice(0, 10).reduce((s, h) => s + h.weightPct, 0);
  const sectorMap = new Map<string, number>();
  for (const h of input.holdings) {
    const k = h.sector?.trim() || "Unclassified";
    sectorMap.set(k, (sectorMap.get(k) ?? 0) + h.weightPct);
  }
  const sectorTilts = [...sectorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const userPrompt = [
    `Fund: ${input.fund.fundName} (${input.fund.fundType.toUpperCase()})`,
    input.fund.fundManager ? `Manager: ${input.fund.fundManager}` : "",
    input.fund.aumNative
      ? `AUM: ${formatUSD(toUSD(input.fund.aumNative, input.fund.currency))} (${input.fund.currency ?? "USD"} ${input.fund.aumNative.toLocaleString()})`
      : "",
    "",
    "Thesis:",
    input.thesis,
    "",
    "Portfolio stats (computed):",
    `- Holdings count: ${input.holdings.length}`,
    `- Top-3 weight: ${top3.toFixed(2)}%`,
    `- Top-10 weight: ${top10.toFixed(2)}%`,
    `- Top sectors: ${sectorTilts.map(([s, w]) => `${s} ${w.toFixed(1)}%`).join(", ")}`,
    "",
    "Top 10 holdings:",
    ...sortedHoldings
      .slice(0, 10)
      .map(
        (h, i) =>
          `${i + 1}. ${h.ticker} — ${h.name} · ${h.weightPct.toFixed(2)}%${h.sector ? ` · ${h.sector}` : ""}`,
      ),
    "",
    "=== BULL ADVOCATE OUTPUT ===",
    JSON.stringify(input.bull, null, 2),
    "",
    "=== BEAR ADVOCATE OUTPUT ===",
    JSON.stringify(input.bear, null, 2),
    "",
    "=== HOUSE VIEW CHECKER OUTPUT ===",
    JSON.stringify(input.houseView, null, 2),
    "",
    "Now produce the structured Fund Investment Memo. Every Finding must retain its original citation. Do not invent.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.reasoning),
    schema: FundSynthesizedMemoSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  const cleaned: import("./types").FundSynthesizedMemo = {
    ...result.object,
    portfolioComposition: {
      ...result.object.portfolioComposition,
      topHoldingsCommentary: enforceCitations(
        result.object.portfolioComposition.topHoldingsCommentary,
      ),
    },
    stressTest: {
      ...result.object.stressTest,
      findings: enforceCitations(result.object.stressTest.findings),
    },
  };

  return {
    output: cleaned,
    audit: {
      agentName: "synthesizer",
      model: MODELS.reasoning,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      durationMs: Date.now() - t0,
    },
  };
}
