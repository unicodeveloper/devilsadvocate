import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { getValyu } from "../valyu";
import { BullAdvocateOutputSchema } from "./types";
import { enforceCitations, type AgentResult, type StockContext } from "./shared";

const SYSTEM = `You are a Bull Advocate analyst. Your job is to restate and strengthen the bullish case for a stock — the strongest, most quantitative version of the thesis.

Rules:
- Every claim MUST cite a real source URL. No exceptions.
- Prefer specific numbers (revenue growth, margins, market share) over generalities.
- If you are not sure of a number, omit the claim rather than fabricate.
- Restrict yourself to the data provided. Do not invent.
- Output 3-6 supporting claims, ranked by how load-bearing they are for the thesis.`;

export type BullAdvocateInput = {
  stock: StockContext;
  thesis: string;
  /** Optional Valyu search results passed in by the orchestrator. */
  supportingContext?: string;
};

export async function bullAdvocate(
  input: BullAdvocateInput,
): Promise<AgentResult<import("./types").BullAdvocateOutput>> {
  const t0 = Date.now();
  const valyu = getValyu();

  // Pull recent positive context if not provided
  let context = input.supportingContext;
  let valyuResponse: unknown;
  if (!context) {
    const res = await valyu.search(
      `${input.stock.name} ${input.stock.ticker} financial performance recent earnings growth`,
      {
        searchType: "all",
        maxNumResults: 6,
        category: "finance",
        responseLength: "medium",
      },
    );
    valyuResponse = res;
    if (res.success) {
      context = (res.results ?? [])
        .map(
          (r, i) =>
            `[${i + 1}] ${r.title}\nURL: ${r.url}\n${typeof r.content === "string" ? r.content : JSON.stringify(r.content ?? "")}\n`,
        )
        .join("\n---\n");
    }
  }

  const userPrompt = [
    `Stock: ${input.stock.ticker} (${input.stock.name})${input.stock.exchange ? `, listed on ${input.stock.exchange}` : ""}`,
    "",
    "Thesis to strengthen:",
    input.thesis,
    "",
    "Supporting context (use ONLY these for citations):",
    context ?? "[no external context retrieved]",
  ].join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.fast),
    schema: BullAdvocateOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
    temperature: 0.2,
  });

  const cleaned = {
    ...result.object,
    supportingClaims: enforceCitations(result.object.supportingClaims),
  };

  return {
    output: cleaned,
    audit: {
      agentName: "bull_advocate",
      model: MODELS.fast,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      valyuResponsesJson: valyuResponse,
      durationMs: Date.now() - t0,
    },
  };
}
