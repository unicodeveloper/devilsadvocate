import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { HouseViewCheckerOutputSchema } from "./types";
import type { AgentResult, StockContext } from "./shared";

const SYSTEM = `You are the House View Checker. The firm publishes a markdown one-pager that is the "Source of Truth" — investment framework, current house calls, and hard rules.

Your job: evaluate a thesis against the House View. Be precise.

Rules:
- Identify each rule or stance from the House View. For each, mark verdict as "pass", "fail", or "n_a" (not applicable).
- Cite the House View location for each evaluation (use "house-view.md" as the citation URL with a quote of the rule text).
- The overallAlignment field summarizes the headline read.
- Use "divergence" to highlight cases where the thesis explicitly contradicts the House View.
- Quote the exact rule text in evidence.quote so the reader can verify.`;

export type HouseViewCheckerInput = {
  stock: StockContext;
  thesis: string;
  houseViewMarkdown: string;
};

export async function houseViewChecker(
  input: HouseViewCheckerInput,
): Promise<AgentResult<import("./types").HouseViewCheckerOutput>> {
  const t0 = Date.now();

  const userPrompt = [
    "House View (source of truth):",
    "```markdown",
    input.houseViewMarkdown,
    "```",
    "",
    `Stock: ${input.stock.ticker} (${input.stock.name})`,
    "",
    "Thesis to evaluate:",
    input.thesis,
  ].join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.fast),
    schema: HouseViewCheckerOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  return {
    output: result.object,
    audit: {
      agentName: "house_view_checker",
      model: MODELS.fast,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      durationMs: Date.now() - t0,
    },
  };
}
