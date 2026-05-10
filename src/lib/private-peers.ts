import { getValyu } from "./valyu";
import type { Citation } from "./agents/types";

export type PrivatePeerDossier = {
  peers: Array<{
    name: string;
    summary: string;
    citations: Citation[];
  }>;
  /** Markdown rendering of the dossier — used directly in the Bear prompt. */
  dossierMarkdown: string;
};

export type StockForPeers = {
  ticker: string;
  name: string;
};

const EMPTY: PrivatePeerDossier = { peers: [], dossierMarkdown: "" };

/**
 * Parse a comma/newline-separated string of private-competitor names into a
 * cleaned, deduped list. Handles the common formatting analysts will use.
 */
export function parsePrivatePeers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,\n;]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 2 && s.length <= 80),
    ),
  ].slice(0, 5);
}

/**
 * For each named private competitor, fetch a focused profile via Valyu Answer.
 * The output is markdown that the Bear Advocate prepends to its research input
 * — peer findings end up as citations inside the bear's structured output.
 */
export async function fetchPrivatePeerDossier(
  peers: string[],
  stock: StockForPeers,
): Promise<PrivatePeerDossier> {
  if (peers.length === 0) return EMPTY;

  const results = await Promise.all(
    peers.map((peer) => fetchOnePeer(peer, stock)),
  );

  const successful = results.filter((r) => r.summary.length > 0);
  if (successful.length === 0) return EMPTY;

  const dossierMarkdown = [
    "## Private Peer Dossier (Valyu)",
    `Targeted research on private competitors of ${stock.name} (${stock.ticker}).`,
    ...successful.map(
      (r) =>
        `### ${r.name}\n\n${r.summary}\n\n${
          r.citations.length > 0
            ? `**Sources:**\n${r.citations
                .slice(0, 8)
                .map((c, i) => `[${i + 1}] ${c.title ?? "Source"} — ${c.url}`)
                .join("\n")}`
            : "_No citations returned._"
        }`,
    ),
  ].join("\n\n");

  return { peers: successful, dossierMarkdown };
}

async function fetchOnePeer(
  peerName: string,
  stock: StockForPeers,
): Promise<{ name: string; summary: string; citations: Citation[] }> {
  const valyu = getValyu();
  const query = [
    `Build a focused business + financial profile for the private/unlisted company "${peerName}".`,
    `${peerName} is a competitor of the listed company ${stock.name} (${stock.ticker}).`,
    "Surface specifically:",
    "1. Latest funding round (date, amount raised, valuation, lead investors).",
    "2. Recent revenue or revenue-growth signals from press releases, founder interviews, or filings (MCA AOC-4 if Indian).",
    "3. Margin or unit-economics commentary, even if qualitative.",
    "4. Traction or market-share trends versus the listed peer.",
    `5. Strategic moves that could pressure ${stock.name} (geographic expansion, product launches, pricing actions, customer wins).`,
    "Cite specific source URLs for every claim. If the company's name is ambiguous, prefer the company most likely to compete with the listed peer.",
  ].join(" ");

  try {
    const raw = await valyu.answer(query, {
      searchType: "all",
      streaming: false,
    });
    const res = raw as Awaited<ReturnType<typeof valyu.answer>> extends infer T
      ? T extends { success: boolean }
        ? T
        : never
      : never;
    if (!("success" in res) || !res.success) {
      return { name: peerName, summary: "", citations: [] };
    }
    const summary =
      typeof res.contents === "string"
        ? res.contents
        : JSON.stringify(res.contents ?? "");
    const citations: Citation[] = (res.search_results ?? [])
      .slice(0, 10)
      .map((s) => ({
        url: s.url,
        title: s.title,
        quote: typeof s.content === "string" ? s.content.slice(0, 200) : null,
      }));
    return { name: peerName, summary, citations };
  } catch {
    return { name: peerName, summary: "", citations: [] };
  }
}
