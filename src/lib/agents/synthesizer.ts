import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { SynthesizedMemoSchema } from "./types";
import { enforceCitations, type AgentResult, type StockContext } from "./shared";
import type {
  BearAdvocateOutput,
  BullAdvocateOutput,
  HouseViewCheckerOutput,
} from "./types";

const SYSTEM = `You are the Synthesizer. You receive three independent agent outputs (Bull Advocate, Bear Advocate, House View Checker) and produce a single, structured Investment Memo for the CIO.

Your job:
1. Setup — 2-3 sentence summary of the stock and the thesis. Add 4-8 key metrics if available in the agents' outputs.
2. House View Overlay — start with a one-line verdict (aligned / partially aligned / violates) and reproduce the rule-by-rule verdicts.
3. Stress-Test (THE CORE) — synthesize the strongest contrarian case. Include the most load-bearing risks first. Preserve confidence labels and citations EXACTLY as provided. Do not invent new findings.
4. Consensus Summary — a one-line headline if discernible from the data.
5. Final Verdict — your overall read: constructive / cautious / avoid / inconclusive, with reasoning and a confidence label.

CRITICAL RULES:
- DO NOT invent claims. Every Finding must come from one of the three input agents and retain its original citation(s).
- DO NOT inflate confidence. If the bear marked something "low", keep it "low" in the output.
- DO NOT fabricate citation URLs. If a finding has no citation, drop it.
- The Final Verdict's confidence reflects how strong the overall evidence is — high only if multiple independent sources align.`;

export type SynthesizerInput = {
  stock: StockContext;
  thesis: string;
  bull: BullAdvocateOutput;
  bear: BearAdvocateOutput;
  houseView: HouseViewCheckerOutput;
};

export async function synthesizer(
  input: SynthesizerInput,
): Promise<AgentResult<import("./types").SynthesizedMemo>> {
  const t0 = Date.now();

  const userPrompt = [
    `Stock: ${input.stock.ticker} (${input.stock.name})`,
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
    "Now produce the structured Investment Memo. Remember: every Finding must have at least one valid citation, copied verbatim from the source agent. Do not invent.",
  ].join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.reasoning),
    schema: SynthesizedMemoSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  // Strict citation enforcement on stress-test findings and consensus notes.
  const cleaned: import("./types").SynthesizedMemo = {
    ...result.object,
    stressTest: {
      ...result.object.stressTest,
      findings: enforceCitations(result.object.stressTest.findings),
    },
    consensusSummary: {
      ...result.object.consensusSummary,
      notes: result.object.consensusSummary.notes
        ? enforceCitations(result.object.consensusSummary.notes)
        : null,
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
