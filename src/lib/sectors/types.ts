import type { Citation } from "../agents/types";

export const SECTOR_KEYS = [
  "auto",
  "banking",
  "it_services",
  "oil_gas",
  "fmcg",
  "pharma",
  "export_import",
  "unknown",
] as const;

export type SectorKey = (typeof SECTOR_KEYS)[number];

export const SECTOR_LABELS: Record<SectorKey, string> = {
  auto: "Auto",
  banking: "Banking & Finance",
  it_services: "IT Services",
  oil_gas: "Oil, Gas & Energy",
  fmcg: "FMCG / Consumption",
  pharma: "Pharma",
  export_import: "Export / Import",
  unknown: "Unclassified",
};

export type SectorSignal = {
  label: string;
  body: string;
  citations: Citation[];
};

export type SectorDossier = {
  sectorKey: SectorKey;
  sectorLabel: string;
  source: "openfda" | "valyu" | "none";
  signals: SectorSignal[];
  /** Markdown rendering of the dossier — used directly in the Bear prompt. */
  dossierMarkdown: string;
};

export type StockForSector = {
  ticker: string;
  name: string;
  sector: string | null;
};
