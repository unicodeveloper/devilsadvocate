import { classifySector } from "./classify";
import { fetchPharmaSectorDossier } from "./fda";
import { emptyDossier, fetchSectorDossierValyu } from "./valyu-adapter";
import {
  SECTOR_LABELS,
  type SectorDossier,
  type SectorKey,
  type StockForSector,
} from "./types";

export { classifySector, SECTOR_LABELS };
export type { SectorDossier, SectorKey, StockForSector };

/**
 * Fetch a sector-specific dossier for a stock. Pharma uses the openFDA real
 * API for enforcement actions; everything else uses sector-templated Valyu
 * queries that name the canonical source (Vahan, RBI DBIE, PPAC, etc).
 */
export async function fetchSectorDossier(
  stock: StockForSector,
  sectorKey?: SectorKey,
): Promise<SectorDossier> {
  const key = sectorKey ?? classifySector(stock);

  if (key === "unknown") return emptyDossier(key);
  if (key === "pharma") return fetchPharmaSectorDossier(stock);
  return fetchSectorDossierValyu(key, stock);
}
