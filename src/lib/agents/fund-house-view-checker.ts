import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { FundHouseViewCheckerOutputSchema } from "./types";
import type { AgentResult } from "./shared";
import type {
  FundContext,
  FundHoldingForAgent,
} from "./fund-bull-advocate";

const SYSTEM = `You are the House View Checker for funds. The firm publishes a markdown one-pager — investment framework, current house calls, hard rules. Your job: evaluate each rule against the fund's actual holdings.

Rules:
- For each rule, decide if it applies. If it does, identify which holdings VIOLATE it.
- "verdict": "pass" = all relevant holdings comply, "fail" = all violate, "mixed" = some violate, "n_a" = rule doesn't apply to this fund's universe.
- For violatingHoldings, include ticker, name, weight, and a one-line "reason" specific to the rule.
- weightedViolationPct = sum of violatingHoldings[].weightPct.
- Quote the exact rule text in evidence.quote and use "house-view.md" as the URL.
- totalViolationWeightPct = aggregate weight of holdings that violate ANY rule (de-dupe by ticker).
- Do not invent holdings. Use only the provided holdings list.`;

export type FundHouseViewCheckerInput = {
  fund: FundContext;
  thesis: string;
  holdings: FundHoldingForAgent[];
  houseViewMarkdown: string;
};

export async function fundHouseViewChecker(
  input: FundHouseViewCheckerInput,
): Promise<AgentResult<import("./types").FundHouseViewCheckerOutput>> {
  const t0 = Date.now();

  const userPrompt = [
    "House View (source of truth):",
    "```markdown",
    input.houseViewMarkdown,
    "```",
    "",
    `Fund: ${input.fund.fundName} (${input.fund.fundType.toUpperCase()})`,
    "",
    "Thesis:",
    input.thesis,
    "",
    "Full holdings (every row):",
    ...input.holdings.map(
      (h, i) =>
        `${i + 1}. ${h.ticker} — ${h.name} · ${h.weightPct.toFixed(2)}%${h.sector ? ` · ${h.sector}` : ""}`,
    ),
  ].join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.fast),
    schema: FundHouseViewCheckerOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
    temperature: 0.1,
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
