import type { Citation } from "../agents/types";
import { getValyu } from "../valyu";
import { SECTOR_LABELS, type SectorDossier, type SectorKey, type StockForSector } from "./types";

/**
 * Sector-specific Valyu queries. Each query names the canonical data source
 * (Vahan, RBI DBIE, PPAC, etc.) so Valyu prefers those sources where indexed.
 */
const QUERY_BUILDERS: Partial<Record<SectorKey, (s: StockForSector) => string>> =
  {
    auto: (s) =>
      `Latest monthly Vahan vehicle registration data and segment trends most relevant to ${s.name} (${s.ticker}). Surface YoY changes by passenger / 2W / 3W / commercial vehicle as applicable, OEM-level share shifts, and any rural-vs-urban divergence. Include source URLs (Vahan dashboard, SIAM, FADA monthly bulletins).`,
    banking: (s) =>
      `Latest RBI DBIE credit-growth, deposit-growth, and NPA trend data plus relevant CMIE indicators for ${s.name} (${s.ticker}). Surface aggregate sector data and any peer-bank comparisons. Include source URLs (RBI DBIE, RBI press releases, CMIE).`,
    it_services: (s) =>
      `Latest US/EU IT services hiring trends and deal TCV data relevant to ${s.name} (${s.ticker}). Surface large-deal wins/losses, BFSI/retail discretionary spend signals, NASSCOM commentary, and Gartner forecast revisions. Include source URLs (Gartner, NASSCOM, company filings).`,
    oil_gas: (s) =>
      `Latest PPAC monthly refining, marketing, and consumption data plus power-demand indicators relevant to ${s.name} (${s.ticker}). Surface refining margin trends, GRM, marketing margin, and power-sector demand growth. Include source URLs (PPAC, CEA, Petroleum Ministry).`,
    fmcg: (s) =>
      `Latest rural wage data, rainfall + Kharif/Rabi sowing data, and Agmarknet/CMIE rural demand indicators relevant to ${s.name} (${s.ticker}). Surface YoY rural FMCG volume signals and key input commodity moves. Include source URLs (Agmarknet, CMIE, Ministry of Agriculture).`,
    export_import: (s) =>
      `Latest Indian export/import volumes by HS code most relevant to ${s.name} (${s.ticker}), including DGFT data, container traffic, and Seair/Volza commentary. Surface YoY trade-volume shifts and major-corridor changes. Include source URLs.`,
  };

export async function fetchSectorDossierValyu(
  sectorKey: SectorKey,
  stock: StockForSector,
  accessToken?: string,
): Promise<SectorDossier> {
  const builder = QUERY_BUILDERS[sectorKey];
  if (!builder) {
    return emptyDossier(sectorKey);
  }

  const valyu = getValyu(accessToken);
  const query = builder(stock);

  let answerContents = "";
  const citations: Citation[] = [];

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
    if ("success" in res && res.success) {
      answerContents =
        typeof res.contents === "string"
          ? res.contents
          : JSON.stringify(res.contents ?? "");
      for (const r of res.search_results ?? []) {
        citations.push({
          url: r.url,
          title: r.title,
          quote:
            typeof r.content === "string" ? r.content.slice(0, 200) : null,
        });
      }
    }
  } catch {
    answerContents = "";
  }

  if (!answerContents) {
    return emptyDossier(sectorKey);
  }

  const dossierMarkdown = [
    `## ${SECTOR_LABELS[sectorKey]} Sector Dossier (Valyu)`,
    answerContents,
    citations.length > 0
      ? `\n### Sources\n${citations
          .slice(0, 8)
          .map((c, i) => `[${i + 1}] ${c.title} — ${c.url}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    sectorKey,
    sectorLabel: SECTOR_LABELS[sectorKey],
    source: "valyu",
    signals: [
      {
        label: `${SECTOR_LABELS[sectorKey]} signal summary`,
        body: answerContents,
        citations,
      },
    ],
    dossierMarkdown,
  };
}

export function emptyDossier(sectorKey: SectorKey): SectorDossier {
  return {
    sectorKey,
    sectorLabel: SECTOR_LABELS[sectorKey],
    source: "none",
    signals: [],
    dossierMarkdown: "",
  };
}
