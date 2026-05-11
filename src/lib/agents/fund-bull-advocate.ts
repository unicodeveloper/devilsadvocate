import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { getValyu } from "../valyu";
import { formatUSD, toUSD } from "../fx";
import { FundBullAdvocateOutputSchema } from "./types";
import { enforceCitations, type AgentResult } from "./shared";

const SYSTEM = `You are a Bull Advocate analyst for funds (mutual funds, PMS, AIF). Your job is to articulate the strongest case for the fund's strategy as expressed by its current portfolio.

Rules:
- Every claim MUST cite a real source URL. No exceptions.
- Use specific numbers from the portfolio (weights, sector tilts) and supporting external context (manager track record, sector outlooks).
- If a claim cannot be sourced, drop it. Do not fabricate.
- Top-pick rationales should explain why each load-bearing holding fits the thesis.
- Portfolio strengths should be load-bearing: diversification, manager pedigree, fee structure, vintage.`;

export type FundContext = {
  fundId: string;
  fundName: string;
  fundType: "mf" | "pms" | "aif";
  fundManager: string | null;
  aumNative: number | null;
  currency: string | null;
};

export type FundHoldingForAgent = {
  ticker: string;
  name: string;
  weightPct: number;
  sector: string | null;
  valueNative: number | null;
};

export type FundBullAdvocateInput = {
  fund: FundContext;
  thesis: string;
  holdings: FundHoldingForAgent[];
  /** OAuth token in valyu mode; routes Valyu calls to the user's credits. */
  accessToken?: string;
};

export async function fundBullAdvocate(
  input: FundBullAdvocateInput,
): Promise<AgentResult<import("./types").FundBullAdvocateOutput>> {
  const t0 = Date.now();
  const valyu = getValyu(input.accessToken);
  const top = input.holdings.slice(0, 8);

  const tickerNames = top.map((h) => `${h.ticker} (${h.name})`).join(", ");
  const supportRes = await valyu.search(
    `${input.fund.fundName} ${input.fund.fundManager ?? ""} strategy performance ${tickerNames}`,
    {
      searchType: "all",
      maxNumResults: 8,
      category: "finance",
      responseLength: "medium",
    },
  );
  const supportContext = supportRes.success
    ? (supportRes.results ?? [])
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${typeof r.content === "string" ? r.content : JSON.stringify(r.content ?? "")}`,
        )
        .join("\n---\n")
    : "[no external context retrieved]";

  const userPrompt = [
    `Fund: ${input.fund.fundName} (${input.fund.fundType.toUpperCase()})`,
    input.fund.fundManager ? `Manager: ${input.fund.fundManager}` : "",
    input.fund.aumNative
      ? `AUM: ${formatUSD(toUSD(input.fund.aumNative, input.fund.currency))} (${input.fund.currency ?? "USD"} ${input.fund.aumNative.toLocaleString()})`
      : "",
    "",
    "Thesis to strengthen:",
    input.thesis,
    "",
    "Top holdings (highest weight first):",
    ...top.map(
      (h, i) =>
        `${i + 1}. ${h.ticker} — ${h.name} · ${h.weightPct.toFixed(2)}%${h.sector ? ` · ${h.sector}` : ""}`,
    ),
    "",
    "Supporting context (use ONLY these for citations):",
    supportContext,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.fast),
    schema: FundBullAdvocateOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  const cleaned = {
    ...result.object,
    topPickRationales: enforceCitations(result.object.topPickRationales),
    portfolioStrengths: enforceCitations(result.object.portfolioStrengths),
  };

  return {
    output: cleaned,
    audit: {
      agentName: "bull_advocate",
      model: MODELS.fast,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      valyuResponsesJson: supportRes,
      durationMs: Date.now() - t0,
    },
  };
}
