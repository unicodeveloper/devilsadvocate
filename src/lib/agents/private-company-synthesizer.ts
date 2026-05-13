import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { PrivateCompanySynthesizedMemoSchema } from "./types";
import { enforceCitations, stageLabel, type AgentResult } from "./shared";
import type {
  PrivateCompanyBearAdvocateOutput,
  PrivateCompanyBullAdvocateOutput,
  PrivateCompanyHouseViewCheckerOutput,
  PrivateCompanyRoundStage,
  PrivateCompanySynthesizedMemo,
} from "./types";

const SYSTEM = `You are the Synthesizer for private-company (venture / angel) deal memos. You receive three agent outputs (Bull, Bear, House View) and produce one structured memo for the angel / family-office CIO / solo GP.

Your job:
1. setup — 2-3 sentence overview of the deal. Add quick-glance keyFacts: stage, sector, geo, check size, post-money, founders.
2. houseViewOverlay — start with a one-line headline (aligned / partially aligned / violates). Reflect both qualitative rule verdicts AND mechanical violations. Mechanical violations are facts — surface them verbatim.
3. stressTest — the strongest contrarian view, drawing from the Bear's findings across team / market / competition / product / terms. Preserve confidence labels and citations EXACTLY.
4. dataGaps — THIS IS LOAD-BEARING. List the items the tool could not verify from public data and the investor must request from the data room before committing capital. Use the dataGap categories. The angel decision dies in the gaps, not the visible bear case. Always include at least 3 items.
5. finalVerdict — proceed / size_down / kill / inconclusive. A mechanical mandate violation should typically push toward kill or size_down. Provide concrete reasoning.

CRITICAL RULES:
- DO NOT invent claims. Every Finding in stressTest must come from one of the three input agents and retain its original citation(s).
- DO NOT inflate confidence. If the bear marked something "low", keep it "low".
- DO NOT fabricate citation URLs. Findings without citations are stripped.
- For dataGaps: be specific. "Last 6 months MRR + churn cohort table" beats "financial data".
- finalVerdict.confidence reflects evidence strength overall: high only if mechanical violations OR multiple independent bear findings align.`;

export type PrivateCompanySynthesizerInput = {
  company: {
    name: string;
    url: string;
    founders: string[];
    roundStage: PrivateCompanyRoundStage;
    sector: string | null;
    geo: string | null;
    checkSizeUsd: number | null;
    postMoneyUsd: number | null;
  };
  thesis: string;
  bull: PrivateCompanyBullAdvocateOutput;
  bear: PrivateCompanyBearAdvocateOutput;
  houseView: PrivateCompanyHouseViewCheckerOutput;
};

export async function privateCompanySynthesizer(
  input: PrivateCompanySynthesizerInput,
): Promise<AgentResult<PrivateCompanySynthesizedMemo>> {
  const t0 = Date.now();

  const userPrompt = [
    `Company: ${input.company.name} (${input.company.url})`,
    `Stage: ${stageLabel(input.company.roundStage)}`,
    input.company.founders.length > 0
      ? `Founders: ${input.company.founders.join(", ")}`
      : "",
    input.company.sector ? `Sector: ${input.company.sector}` : "",
    input.company.geo ? `Geography: ${input.company.geo}` : "",
    input.company.checkSizeUsd
      ? `Proposed check: $${input.company.checkSizeUsd.toLocaleString()}`
      : "",
    input.company.postMoneyUsd
      ? `Post-money: $${input.company.postMoneyUsd.toLocaleString()}`
      : "",
    "",
    "Thesis:",
    input.thesis,
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
    "Now produce the structured Deal Memo. The dataGaps section is required — populate it with concrete, named items the investor must request from the data room before commit (revenue, retention, cap table, customer concentration, runway, etc.).",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.reasoning),
    schema: PrivateCompanySynthesizedMemoSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  // Strict citation enforcement on stress-test findings; preserve mechanical
  // violations from the deterministic computation in the house view checker.
  const cleaned: PrivateCompanySynthesizedMemo = {
    ...result.object,
    houseViewOverlay: {
      ...result.object.houseViewOverlay,
      // Always trust the deterministic mechanical violations from the
      // house view checker over anything the synthesizer produced.
      mechanicalViolations: input.houseView.mechanicalViolations,
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
