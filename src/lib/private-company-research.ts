import { getValyu } from "./valyu";
import type { Citation } from "./agents/types";

/**
 * Public-data research dossier for a private company. Three parallel Valyu
 * passes (company profile, founders, competitors) get stitched into a
 * single markdown block the Bear Advocate consumes. Designed for the
 * pre-IC sanity check angle: everything here is public, the data-room
 * stuff lives in `dataGaps` on the synthesized memo.
 */
export type PrivateCompanyResearch = {
  /** Brief profile from website / press / news. */
  companyProfile: { summary: string; citations: Citation[] };
  /** Founder backgrounds from public footprint (LinkedIn-style). */
  founderProfiles: Array<{
    name: string;
    summary: string;
    citations: Citation[];
  }>;
  /** Directly competing companies surfaced via search. */
  competitors: Array<{
    name: string;
    summary: string;
    citations: Citation[];
  }>;
  /** Stitched markdown — what the Bear Advocate actually sees. */
  dossierMarkdown: string;
};

export type PrivateCompanyContext = {
  name: string;
  url: string;
  founders: string[];
  roundStage: "seed" | "series_a" | "series_b";
  sector: string | null;
  geo: string | null;
};

const EMPTY_FINDING = { summary: "", citations: [] as Citation[] };

export async function fetchPrivateCompanyResearch(
  ctx: PrivateCompanyContext,
  accessToken?: string,
): Promise<PrivateCompanyResearch> {
  const [company, founderResults, competitors] = await Promise.all([
    fetchCompanyProfile(ctx, accessToken),
    Promise.all(
      ctx.founders
        .slice(0, 4)
        .map((f) => fetchFounderProfile(f, ctx, accessToken)),
    ),
    fetchCompetitors(ctx, accessToken),
  ]);

  const founderProfiles = founderResults.filter((r) => r.summary.length > 0);
  const dossierMarkdown = buildDossierMarkdown(
    ctx,
    company,
    founderProfiles,
    competitors,
  );

  return {
    companyProfile: company,
    founderProfiles,
    competitors,
    dossierMarkdown,
  };
}

async function fetchCompanyProfile(
  ctx: PrivateCompanyContext,
  accessToken?: string,
): Promise<{ summary: string; citations: Citation[] }> {
  const valyu = getValyu(accessToken);
  const query = [
    `Build a focused profile for the private company "${ctx.name}" (${ctx.url}).`,
    `Stage: ${ctx.roundStage === "series_b" ? "Series B" : ctx.roundStage === "series_a" ? "Series A" : "Seed"}.`,
    ctx.sector ? `Sector: ${ctx.sector}.` : "",
    ctx.geo ? `Geography: ${ctx.geo}.` : "",
    "Surface specifically:",
    "1. What the product actually does (one paragraph, no marketing language).",
    "2. Latest funding round (date, amount, valuation, lead investors) if public.",
    "3. Headcount + hiring velocity (Linkedin / job-board signals).",
    "4. Press / news in the last 12 months — both positive and negative.",
    "5. Any public revenue, traction, or user-growth claims (with the source).",
    "Cite every claim with a real URL. If you can't verify a claim from public sources, omit it.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const raw = await valyu.answer(query, {
      searchType: "all",
      streaming: false,
    });
    return extractAnswerResult(raw);
  } catch {
    return EMPTY_FINDING;
  }
}

async function fetchFounderProfile(
  name: string,
  ctx: PrivateCompanyContext,
  accessToken?: string,
): Promise<{ name: string; summary: string; citations: Citation[] }> {
  const valyu = getValyu(accessToken);
  const query = [
    `Build a focused background profile for "${name}", a founder of "${ctx.name}".`,
    "Surface specifically:",
    "1. Prior companies founded — outcomes (acquired, shut down, still operating, IPO).",
    "2. Operating roles at notable companies before founding.",
    "3. Domain expertise relevant to this market.",
    "4. Public flags: prior litigation, departures-under-cloud, controversial statements.",
    "5. Co-founder history with existing teammates, if discoverable.",
    "Cite every claim. Do not infer. If the founder name is ambiguous, prefer the one publicly associated with " +
      `"${ctx.name}" (${ctx.url}).`,
  ].join(" ");

  try {
    const raw = await valyu.answer(query, {
      searchType: "all",
      streaming: false,
    });
    const { summary, citations } = extractAnswerResult(raw);
    return { name, summary, citations };
  } catch {
    return { name, summary: "", citations: [] };
  }
}

async function fetchCompetitors(
  ctx: PrivateCompanyContext,
  accessToken?: string,
): Promise<Array<{ name: string; summary: string; citations: Citation[] }>> {
  const valyu = getValyu(accessToken);
  // One call to discover competitors, then short summaries from search results
  // — saves per-competitor LLM round-trips.
  const query = [
    `List the 4-6 most credible direct competitors to "${ctx.name}" (${ctx.url}).`,
    ctx.sector ? `Sector: ${ctx.sector}.` : "",
    "Prefer venture-funded companies and well-known bootstrapped competitors.",
    "For each competitor, give: name, one-line description, last known funding (round + lead investor + date), and one signal that makes them a threat.",
    "Output a clean list. Cite each competitor with a URL.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const raw = await valyu.search(query, {
      searchType: "all",
      maxNumResults: 10,
      category: "finance",
      responseLength: "medium",
    });
    const res = raw as Awaited<ReturnType<typeof valyu.search>>;
    if (!res?.success || !res.results) return [];
    // Hand the raw search results straight through — the Bear Advocate
    // can read them. We don't try to parse out per-competitor structure
    // here; that's the LLM's job downstream and saves a round-trip.
    return res.results.slice(0, 8).map((r) => ({
      name: r.title ?? "Unknown competitor",
      summary:
        typeof r.content === "string"
          ? r.content.slice(0, 1200)
          : JSON.stringify(r.content ?? ""),
      citations: [
        {
          url: r.url,
          title: r.title ?? null,
          quote:
            typeof r.content === "string"
              ? r.content.slice(0, 200)
              : null,
        },
      ],
    }));
  } catch {
    return [];
  }
}

function extractAnswerResult(raw: unknown): {
  summary: string;
  citations: Citation[];
} {
  const res = raw as {
    success?: boolean;
    contents?: unknown;
    search_results?: Array<{
      url: string;
      title?: string;
      content?: unknown;
    }>;
  };
  if (!res?.success) return EMPTY_FINDING;
  const summary =
    typeof res.contents === "string"
      ? res.contents
      : JSON.stringify(res.contents ?? "");
  const citations: Citation[] = (res.search_results ?? [])
    .slice(0, 10)
    .map((s) => ({
      url: s.url,
      title: s.title ?? null,
      quote: typeof s.content === "string" ? s.content.slice(0, 200) : null,
    }));
  return { summary, citations };
}

function buildDossierMarkdown(
  ctx: PrivateCompanyContext,
  company: { summary: string; citations: Citation[] },
  founderProfiles: Array<{
    name: string;
    summary: string;
    citations: Citation[];
  }>,
  competitors: Array<{ name: string; summary: string; citations: Citation[] }>,
): string {
  const sections: string[] = [];
  sections.push(
    `## Private Company Dossier (Valyu)\nFocused public-data research on **${ctx.name}** (${ctx.url}).`,
  );

  if (company.summary) {
    sections.push(`### Company profile\n\n${company.summary}\n\n${renderCitations(company.citations)}`);
  }

  if (founderProfiles.length > 0) {
    const founderBlocks = founderProfiles
      .map(
        (f) =>
          `#### ${f.name}\n\n${f.summary}\n\n${renderCitations(f.citations)}`,
      )
      .join("\n\n");
    sections.push(`### Founder backgrounds\n\n${founderBlocks}`);
  }

  if (competitors.length > 0) {
    const compBlocks = competitors
      .map(
        (c, i) =>
          `**${i + 1}. ${c.name}** — ${c.summary}\n${renderCitations(c.citations)}`,
      )
      .join("\n\n");
    sections.push(`### Competitor landscape\n\n${compBlocks}`);
  }

  return sections.join("\n\n");
}

function renderCitations(citations: Citation[]): string {
  if (citations.length === 0) return "_No citations returned._";
  return [
    "**Sources:**",
    ...citations
      .slice(0, 8)
      .map((c, i) => `[${i + 1}] ${c.title ?? "Source"} — ${c.url}`),
  ].join("\n");
}
