import type { Citation } from "../agents/types";
import type { SectorDossier, SectorSignal, StockForSector } from "./types";

const FDA_ENFORCEMENT_URL = "https://api.fda.gov/drug/enforcement.json";
const FDA_SEARCH_PORTAL = "https://www.accessdata.fda.gov/scripts/drugshortages/";

type FdaEnforcementResult = {
  recall_number?: string;
  classification?: string;
  status?: string;
  recall_initiation_date?: string;
  product_description?: string;
  reason_for_recall?: string;
  voluntary_mandated?: string;
  city?: string;
  state?: string;
  country?: string;
  openfda?: {
    manufacturer_name?: string[];
  };
};

type FdaResponse = {
  results?: FdaEnforcementResult[];
  meta?: { results: { total: number } };
  error?: { code: string; message: string };
};

/**
 * Pull recent FDA drug enforcement reports for an Indian pharma company.
 * Uses the openFDA public API — no key required for low-volume use.
 *
 * Returns a SectorDossier whose signals list each enforcement action with
 * a citation back to FDA's drug shortages portal.
 */
export async function fetchPharmaSectorDossier(
  stock: StockForSector,
): Promise<SectorDossier> {
  const candidates = manufacturerCandidates(stock);

  if (candidates.length === 0) {
    return {
      sectorKey: "pharma",
      sectorLabel: "Pharma",
      source: "openfda",
      signals: [],
      dossierMarkdown: noManufacturerNotice(stock),
    };
  }

  const results = await Promise.all(
    candidates.map((name) => fetchEnforcement(name)),
  );

  const allRows = results.flatMap((r) => r.results);
  const queryUsed = results.find((r) => r.queryUsed)?.queryUsed ?? candidates[0];

  if (allRows.length === 0) {
    return {
      sectorKey: "pharma",
      sectorLabel: "Pharma",
      source: "openfda",
      signals: [
        {
          label: `No FDA enforcement actions found for "${queryUsed}"`,
          body: "openFDA returned zero recall / enforcement reports for this manufacturer over the last 24 months. Absence of evidence is not evidence of absence — verify manually if the company exports to the US.",
          citations: [
            { url: "https://api.fda.gov/", title: "openFDA API", quote: null },
          ],
        },
      ],
      dossierMarkdown: emptyMarkdown(stock, queryUsed),
    };
  }

  const grouped = groupByYear(allRows);
  const signals: SectorSignal[] = [];
  const allCitations: Citation[] = [];

  for (const [year, rows] of grouped) {
    const classes = countByClass(rows);
    const recentReasons = rows
      .slice(0, 5)
      .map((r) => `- ${r.recall_initiation_date ?? "unknown date"}: ${r.reason_for_recall ?? "no reason given"} (${r.classification ?? "Unclassified"})`)
      .join("\n");

    const citations: Citation[] = rows.slice(0, 5).map((r) => ({
      url: r.recall_number
        ? `${FDA_SEARCH_PORTAL}?recall_number=${encodeURIComponent(r.recall_number)}`
        : "https://www.accessdata.fda.gov/scripts/drugshortages/",
      title: r.recall_number
        ? `FDA recall ${r.recall_number}`
        : "FDA enforcement report",
      quote: r.reason_for_recall ?? null,
    }));
    allCitations.push(...citations);

    signals.push({
      label: `${year}: ${rows.length} FDA enforcement action${rows.length === 1 ? "" : "s"} (${formatClassCounts(classes)})`,
      body: recentReasons,
      citations,
    });
  }

  const dossierMarkdown = buildPharmaMarkdown(
    queryUsed,
    allRows.length,
    signals,
  );

  return {
    sectorKey: "pharma",
    sectorLabel: "Pharma",
    source: "openfda",
    signals,
    dossierMarkdown,
  };
}

async function fetchEnforcement(
  manufacturerName: string,
): Promise<{ results: FdaEnforcementResult[]; queryUsed: string }> {
  // Last 24 months
  const since = new Date();
  since.setFullYear(since.getFullYear() - 2);
  const sinceStr = since.toISOString().slice(0, 10).replace(/-/g, "");
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const search = [
    `openfda.manufacturer_name:"${manufacturerName}"`,
    `recall_initiation_date:[${sinceStr}+TO+${today}]`,
  ].join("+AND+");

  const url = `${FDA_ENFORCEMENT_URL}?search=${search}&limit=20`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // openFDA returns 404 with "NOT_FOUND" body when there are no matches.
      // Treat that as an empty result rather than a failure.
      return { results: [], queryUsed: manufacturerName };
    }
    const data = (await res.json()) as FdaResponse;
    return { results: data.results ?? [], queryUsed: manufacturerName };
  } catch {
    return { results: [], queryUsed: manufacturerName };
  }
}

/**
 * Map a stock name to one or more plausible openFDA `manufacturer_name`
 * candidates. We try multiple variants because FDA filings use legal
 * names that differ from common stock names.
 */
function manufacturerCandidates(stock: StockForSector): string[] {
  const name = stock.name.toLowerCase();
  const known: Record<string, string[]> = {
    "sun pharma": ["Sun Pharmaceutical Industries", "Sun Pharma"],
    "dr reddy": ["Dr. Reddy's Laboratories", "Dr Reddys Laboratories"],
    "dr. reddy": ["Dr. Reddy's Laboratories", "Dr Reddys Laboratories"],
    cipla: ["Cipla"],
    lupin: ["Lupin"],
    aurobindo: ["Aurobindo Pharma"],
    glenmark: ["Glenmark Pharmaceuticals"],
    "torrent pharma": ["Torrent Pharmaceuticals"],
    cadila: ["Cadila Healthcare", "Zydus Lifesciences"],
    zydus: ["Zydus Lifesciences", "Cadila Healthcare"],
    biocon: ["Biocon"],
    alkem: ["Alkem Laboratories"],
    ipca: ["Ipca Laboratories"],
    "divis lab": ["Divis Laboratories", "Divi's Laboratories"],
    "divi's": ["Divi's Laboratories", "Divis Laboratories"],
    natco: ["Natco Pharma"],
  };

  for (const [needle, names] of Object.entries(known)) {
    if (name.includes(needle)) return names;
  }

  // Fallback: strip common suffixes and try the base name.
  const stripped = stock.name
    .replace(/\b(ltd|limited|inc|co|company|industries|laboratories)\b/gi, "")
    .replace(/[.,&]/g, "")
    .trim();

  return stripped.length >= 4 ? [stripped] : [];
}

function groupByYear(
  rows: FdaEnforcementResult[],
): Map<string, FdaEnforcementResult[]> {
  const map = new Map<string, FdaEnforcementResult[]>();
  const sorted = [...rows].sort((a, b) =>
    (b.recall_initiation_date ?? "").localeCompare(
      a.recall_initiation_date ?? "",
    ),
  );
  for (const r of sorted) {
    const y = (r.recall_initiation_date ?? "").slice(0, 4) || "Unknown";
    map.set(y, [...(map.get(y) ?? []), r]);
  }
  return map;
}

function countByClass(rows: FdaEnforcementResult[]) {
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const c = r.classification ?? "Unclassified";
    counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

function formatClassCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
}

function noManufacturerNotice(stock: StockForSector): string {
  return [
    "## FDA Sector Dossier",
    `Could not derive an FDA manufacturer name for ${stock.name}. Skipping enforcement lookup.`,
  ].join("\n\n");
}

function emptyMarkdown(stock: StockForSector, queryUsed: string): string {
  return [
    "## FDA Sector Dossier (openFDA)",
    `Searched openFDA drug enforcement records for **${queryUsed}** (24-month window). No actions found.`,
    `Source: ${FDA_ENFORCEMENT_URL}`,
  ].join("\n\n");
}

function buildPharmaMarkdown(
  queryUsed: string,
  totalRows: number,
  signals: SectorSignal[],
): string {
  const yearBlocks = signals
    .map((s) => `### ${s.label}\n\n${s.body}`)
    .join("\n\n");
  return [
    "## FDA Sector Dossier (openFDA)",
    `Manufacturer queried: **${queryUsed}** · ${totalRows} enforcement record${totalRows === 1 ? "" : "s"} in last 24 months.`,
    `Source: ${FDA_ENFORCEMENT_URL}`,
    yearBlocks,
  ].join("\n\n");
}
