import { generateObject } from "ai";
import { z } from "zod";
import { getOpenAI, MODELS } from "./openai";
import { getValyu } from "./valyu";

export type PrivatePeerSuggestion = {
  name: string;
  rationale: string;
};

const SuggestionsSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().min(2).max(80),
        rationale: z.string().min(10).max(240),
      }),
    )
    .max(4),
});

const SYSTEM = `You suggest PRIVATE (unlisted, non-publicly-traded) companies that compete with a given listed equity.

Rules:
- Only suggest companies that are NOT publicly listed on any major exchange. If you are unsure whether a company is private, leave it out.
- Prefer well-known, named startups, scaleups, or unicorns the user would recognise (e.g. Stripe, Anthropic, SpaceX, Databricks, Ola Electric, Ather Energy).
- 2-4 suggestions max. Quality over quantity. Better to return 2 great picks than 4 weak ones.
- For each, give one tight sentence explaining why they pressure the listed company (product overlap, price, geography, customer steal, etc).
- If the search results clearly contain no credible private competitors, return an empty list.`;

const TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<
  string,
  { value: PrivatePeerSuggestion[]; expiresAt: number }
>();

function cacheKey(ticker: string, name: string) {
  return `${ticker.toUpperCase()}::${name.toLowerCase()}`;
}

export async function suggestPrivatePeers(input: {
  ticker: string;
  name: string;
  sector?: string | null;
}): Promise<PrivatePeerSuggestion[]> {
  const key = cacheKey(input.ticker, input.name);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let searchSnippet = "";
  try {
    const valyu = getValyu();
    const query = [
      `Private, unlisted, VC-backed competitors of ${input.name} (${input.ticker})`,
      input.sector ? `in the ${input.sector} sector` : null,
      "— startups, scaleups, unicorns, or non-public companies that compete directly. Exclude any companies that are publicly listed.",
    ]
      .filter(Boolean)
      .join(" ");
    const res = await valyu.search(query, {
      searchType: "web",
      maxNumResults: 8,
    });
    const results = (res as unknown as { results?: Array<{ title?: string; content?: unknown }> })
      .results ?? [];
    searchSnippet = results
      .slice(0, 8)
      .map((r) => {
        const body =
          typeof r.content === "string"
            ? r.content
            : Array.isArray(r.content)
              ? JSON.stringify(r.content).slice(0, 600)
              : "";
        return `- ${r.title ?? "Untitled"}: ${body.slice(0, 600)}`;
      })
      .join("\n");
  } catch {
    // Search failure is non-fatal — the LLM can still suggest from prior knowledge.
  }

  try {
    const openai = getOpenAI();
    const result = await generateObject({
      model: openai(MODELS.fast),
      system: SYSTEM,
      schema: SuggestionsSchema,
      prompt: [
        `Listed company: ${input.name} (${input.ticker})`,
        input.sector ? `Sector: ${input.sector}` : null,
        "",
        searchSnippet
          ? `Web search context (may be noisy — ignore irrelevant or out-of-date items):\n${searchSnippet}`
          : "No search context available — fall back to your own knowledge of well-known private competitors.",
        "",
        "Return up to 4 PRIVATE competitors. Empty list is acceptable if no high-quality private competitors exist.",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const competitors = result.object.competitors;
    cache.set(key, { value: competitors, expiresAt: Date.now() + TTL_MS });
    return competitors;
  } catch {
    return [];
  }
}
