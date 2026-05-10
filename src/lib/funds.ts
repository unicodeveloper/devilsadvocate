import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  funds,
  fundHoldings,
  issuerGroupMembers,
  issuerGroups,
  type Fund,
  type FundHolding,
  type NewFund,
  type NewFundHolding,
} from "./db/schema";
import { toUSD } from "./fx";

export type ParsedHolding = {
  ticker: string;
  name: string;
  weightPctX100: number;
  valueNative: number | null;
  sector: string | null;
  asOfDate: Date | null;
};

export type CsvParseResult = {
  rows: ParsedHolding[];
  warnings: string[];
};

/**
 * Parse a holdings CSV. Required columns (case-insensitive headers):
 *   ticker, name, weight_pct
 * Optional: sector, value_native (or market_value / value), as_of_date.
 * value_native is interpreted in the fund's declared currency.
 */
export function parseHoldingsCsv(text: string): CsvParseResult {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error("Empty CSV");
  }

  const headerCells = splitCsvLine(lines[0]).map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_"),
  );
  const colIdx = (name: string | string[]) => {
    const candidates = Array.isArray(name) ? name : [name];
    for (const c of candidates) {
      const i = headerCells.indexOf(c);
      if (i >= 0) return i;
    }
    return -1;
  };

  const tickerIdx = colIdx(["ticker", "symbol", "isin"]);
  const nameIdx = colIdx(["name", "security", "company", "stock_name"]);
  const weightIdx = colIdx(["weight_pct", "weight", "weightage", "pct"]);
  const sectorIdx = colIdx("sector");
  const valueIdx = colIdx(["value_native", "market_value", "value", "value_inr"]);
  const dateIdx = colIdx(["as_of_date", "as_of", "date"]);

  if (tickerIdx < 0) {
    throw new Error(
      "CSV missing required column: ticker (or symbol / isin)",
    );
  }
  if (nameIdx < 0) {
    throw new Error("CSV missing required column: name (or security)");
  }
  if (weightIdx < 0) {
    throw new Error(
      "CSV missing required column: weight_pct (or weight / pct)",
    );
  }

  const rows: ParsedHolding[] = [];
  let totalWeightX100 = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const ticker = (cells[tickerIdx] ?? "").trim();
    const name = (cells[nameIdx] ?? "").trim();
    const rawWeight = (cells[weightIdx] ?? "").trim();
    if (!ticker || !name || !rawWeight) {
      warnings.push(`Row ${i + 1} skipped: missing ticker, name, or weight`);
      continue;
    }
    const weightNumeric = Number(rawWeight.replace(/%/g, ""));
    if (!Number.isFinite(weightNumeric)) {
      warnings.push(`Row ${i + 1} skipped: non-numeric weight "${rawWeight}"`);
      continue;
    }
    const weightPctX100 = Math.round(weightNumeric * 100);
    totalWeightX100 += weightPctX100;

    const sector = sectorIdx >= 0 ? (cells[sectorIdx] ?? "").trim() || null : null;
    const valueRaw = valueIdx >= 0 ? (cells[valueIdx] ?? "").trim() : "";
    const valueNative = valueRaw
      ? Math.round(Number(valueRaw.replace(/[,_\s]/g, "")))
      : null;

    let asOfDate: Date | null = null;
    if (dateIdx >= 0) {
      const dRaw = (cells[dateIdx] ?? "").trim();
      if (dRaw) {
        const parsed = new Date(dRaw);
        if (!Number.isNaN(parsed.getTime())) asOfDate = parsed;
        else warnings.push(`Row ${i + 1}: unparseable date "${dRaw}"`);
      }
    }

    rows.push({
      ticker: ticker.toUpperCase(),
      name,
      weightPctX100,
      valueNative: Number.isFinite(valueNative) ? valueNative : null,
      sector,
      asOfDate,
    });
  }

  if (rows.length === 0) {
    throw new Error("No valid rows parsed from CSV");
  }

  // Total weight should be ~100% (10000 in x100 form). Warn if way off.
  if (Math.abs(totalWeightX100 - 10000) > 200) {
    warnings.push(
      `Total weights sum to ${(totalWeightX100 / 100).toFixed(2)}% (expected ~100%). Verify the CSV.`,
    );
  }

  return { rows, warnings };
}

function splitCsvLine(line: string): string[] {
  // Minimal CSV: handles quoted cells with embedded commas. Doesn't handle
  // multi-line quoted cells (rare in fund holdings). Sufficient for V1.
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export async function createFund(input: NewFund) {
  const [row] = await db.insert(funds).values(input).returning();
  return row;
}

export async function listFunds() {
  return db.select().from(funds).orderBy(desc(funds.updatedAt));
}

export async function getFundById(id: string) {
  const rows = await db.select().from(funds).where(eq(funds.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listHoldingsForFund(fundId: string) {
  return db
    .select()
    .from(fundHoldings)
    .where(eq(fundHoldings.fundId, fundId))
    .orderBy(desc(fundHoldings.weightPct));
}

/**
 * Replace all holdings for a fund. Holdings are point-in-time snapshots so
 * the caller is responsible for making sure they all share the same as_of date.
 */
export async function replaceFundHoldings(
  fundId: string,
  rows: ParsedHolding[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(fundHoldings).where(eq(fundHoldings.fundId, fundId));
    if (rows.length === 0) return;
    const inserts: NewFundHolding[] = rows.map((r) => ({
      fundId,
      ticker: r.ticker,
      name: r.name,
      weightPct: r.weightPctX100,
      valueNative: r.valueNative ?? undefined,
      sector: r.sector ?? undefined,
      asOfDate: r.asOfDate ?? undefined,
    }));
    await tx.insert(fundHoldings).values(inserts);
    await tx
      .update(funds)
      .set({ updatedAt: new Date() })
      .where(eq(funds.id, fundId));
  });
}

export async function deleteFund(id: string) {
  await db.delete(funds).where(eq(funds.id, id));
}

export type ExposureRow = {
  fundId: string;
  fundName: string;
  fundType: string;
  fundCurrency: string;
  weightPct: number;
  /** Per-fund exposure value, normalised to USD. */
  valueUsd: number | null;
  asOfDate: Date | null;
};

/**
 * Aggregate exposure across all funds for a given list of tickers (treats them
 * as one bucket). Returns per-fund weight and total weighted exposure in USD —
 * each fund's contribution is converted from its declared currency before
 * summing, so multi-currency portfolios produce a coherent total.
 */
export async function aggregateExposureByTickers(tickers: string[]) {
  if (tickers.length === 0) return { perFund: [] as ExposureRow[], totalWeightedAumUsd: 0 };
  const rows = await db
    .select({
      fundId: funds.id,
      fundName: funds.name,
      fundType: funds.type,
      fundCurrency: funds.currency,
      aumNative: funds.aumNative,
      sumWeight: sql<number>`COALESCE(SUM(${fundHoldings.weightPct}), 0)`,
      sumValue: sql<number | null>`SUM(${fundHoldings.valueNative})`,
      asOfDate: sql<number | null>`MAX(${fundHoldings.asOfDate})`,
    })
    .from(funds)
    .leftJoin(
      fundHoldings,
      and(
        eq(fundHoldings.fundId, funds.id),
        inArray(fundHoldings.ticker, tickers),
      ),
    )
    .groupBy(funds.id);

  const perFund: ExposureRow[] = rows
    .filter((r) => Number(r.sumWeight) > 0)
    .map((r) => {
      const ccy = r.fundCurrency ?? "USD";
      // If holdings include a per-position market value, prefer it; otherwise
      // synthesize from AUM × weight. Either path normalises to USD here so the
      // downstream UI never has to think about currency.
      const nativeValue =
        r.sumValue != null
          ? Number(r.sumValue)
          : r.aumNative
            ? (Number(r.aumNative) * Number(r.sumWeight)) / 10000
            : null;
      return {
        fundId: r.fundId,
        fundName: r.fundName,
        fundType: r.fundType,
        fundCurrency: ccy,
        weightPct: Number(r.sumWeight) / 100,
        valueUsd: nativeValue != null ? toUSD(nativeValue, ccy) : null,
        asOfDate: r.asOfDate ? new Date(Number(r.asOfDate)) : null,
      };
    })
    .sort((a, b) => b.weightPct - a.weightPct);

  let totalWeightedAumUsd = 0;
  for (const r of rows) {
    if (r.aumNative && Number(r.sumWeight) > 0) {
      const nativeContribution =
        (Number(r.aumNative) * Number(r.sumWeight)) / 10000;
      totalWeightedAumUsd += toUSD(nativeContribution, r.fundCurrency ?? "USD");
    }
  }

  return { perFund, totalWeightedAumUsd };
}

// ============================================================================
// CROSS-FUND AGGREGATION
// ============================================================================

export type ExposureBreakdown = {
  ticker: string;
  name: string;
  totalWeightPctAcrossFunds: number;
  fundCount: number;
};

export type ExposureResult = {
  perFund: ExposureRow[];
  totalWeightedAumUsd: number;
  totalFundsAffected: number;
  byMember: ExposureBreakdown[];
};

export async function aggregateExposureBySector(
  sector: string,
): Promise<ExposureResult> {
  const tickerRows = await db
    .selectDistinct({ ticker: fundHoldings.ticker })
    .from(fundHoldings)
    .where(eq(fundHoldings.sector, sector));
  const tickers = tickerRows.map((r) => r.ticker);
  return aggregateExposureRich(tickers);
}

export async function aggregateExposureByTickerList(
  tickers: string[],
): Promise<ExposureResult> {
  return aggregateExposureRich(tickers);
}

export async function aggregateExposureByGroupId(
  groupId: string,
): Promise<ExposureResult> {
  const members = await db
    .select({ ticker: issuerGroupMembers.ticker })
    .from(issuerGroupMembers)
    .where(eq(issuerGroupMembers.groupId, groupId));
  return aggregateExposureRich(members.map((m) => m.ticker));
}

async function aggregateExposureRich(
  tickers: string[],
): Promise<ExposureResult> {
  if (tickers.length === 0) {
    return {
      perFund: [],
      totalWeightedAumUsd: 0,
      totalFundsAffected: 0,
      byMember: [],
    };
  }

  const base = await aggregateExposureByTickers(tickers);

  // Per-member breakdown: how much of each ticker we hold across all funds.
  const memberRows = await db
    .select({
      ticker: fundHoldings.ticker,
      name: sql<string>`MIN(${fundHoldings.name})`,
      sumWeight: sql<number>`COALESCE(SUM(${fundHoldings.weightPct}), 0)`,
      fundCount: sql<number>`COUNT(DISTINCT ${fundHoldings.fundId})`,
    })
    .from(fundHoldings)
    .where(inArray(fundHoldings.ticker, tickers))
    .groupBy(fundHoldings.ticker);

  const byMember: ExposureBreakdown[] = memberRows
    .map((r) => ({
      ticker: r.ticker,
      name: r.name,
      totalWeightPctAcrossFunds: Number(r.sumWeight) / 100,
      fundCount: Number(r.fundCount),
    }))
    .sort(
      (a, b) => b.totalWeightPctAcrossFunds - a.totalWeightPctAcrossFunds,
    );

  return {
    perFund: base.perFund,
    totalWeightedAumUsd: base.totalWeightedAumUsd,
    totalFundsAffected: base.perFund.length,
    byMember,
  };
}

export async function listAllSectorsInUse(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ sector: fundHoldings.sector })
    .from(fundHoldings);
  return rows
    .map((r) => r.sector)
    .filter((s): s is string => !!s)
    .sort();
}

export async function listAllTickersInUse(): Promise<
  { ticker: string; name: string; fundCount: number }[]
> {
  const rows = await db
    .select({
      ticker: fundHoldings.ticker,
      name: sql<string>`MIN(${fundHoldings.name})`,
      fundCount: sql<number>`COUNT(DISTINCT ${fundHoldings.fundId})`,
    })
    .from(fundHoldings)
    .groupBy(fundHoldings.ticker)
    .orderBy(fundHoldings.ticker);
  return rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    fundCount: Number(r.fundCount),
  }));
}

// ============================================================================
// ISSUER GROUPS
// ============================================================================

export async function listIssuerGroups() {
  return db.select().from(issuerGroups).orderBy(issuerGroups.name);
}

export async function listIssuerGroupsWithCounts() {
  const rows = await db
    .select({
      id: issuerGroups.id,
      name: issuerGroups.name,
      notes: issuerGroups.notes,
      createdAt: issuerGroups.createdAt,
      updatedAt: issuerGroups.updatedAt,
      memberCount: sql<number>`COUNT(${issuerGroupMembers.id})`,
    })
    .from(issuerGroups)
    .leftJoin(issuerGroupMembers, eq(issuerGroupMembers.groupId, issuerGroups.id))
    .groupBy(issuerGroups.id)
    .orderBy(issuerGroups.name);
  return rows.map((r) => ({ ...r, memberCount: Number(r.memberCount) }));
}

export async function getIssuerGroupWithMembers(id: string) {
  const group = (
    await db.select().from(issuerGroups).where(eq(issuerGroups.id, id)).limit(1)
  )[0];
  if (!group) return null;
  const members = await db
    .select()
    .from(issuerGroupMembers)
    .where(eq(issuerGroupMembers.groupId, id))
    .orderBy(issuerGroupMembers.ticker);
  return { ...group, members };
}

export async function createIssuerGroup(input: {
  name: string;
  notes?: string;
  tickers: string[];
  createdByUserId: string;
}) {
  return db.transaction(async (tx) => {
    const [group] = await tx
      .insert(issuerGroups)
      .values({
        name: input.name,
        notes: input.notes,
        createdByUserId: input.createdByUserId,
      })
      .returning();
    if (input.tickers.length > 0) {
      await tx.insert(issuerGroupMembers).values(
        input.tickers.map((t) => ({
          groupId: group.id,
          ticker: t.toUpperCase().trim(),
        })),
      );
    }
    return group;
  });
}

export async function updateIssuerGroupMeta(
  id: string,
  patch: { name?: string; notes?: string },
) {
  await db
    .update(issuerGroups)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(issuerGroups.id, id));
}

export async function addIssuerGroupMember(groupId: string, ticker: string) {
  const t = ticker.toUpperCase().trim();
  if (!t) throw new Error("Empty ticker");
  await db
    .insert(issuerGroupMembers)
    .values({ groupId, ticker: t })
    .onConflictDoNothing();
  await db
    .update(issuerGroups)
    .set({ updatedAt: new Date() })
    .where(eq(issuerGroups.id, groupId));
}

export async function removeIssuerGroupMember(memberId: string) {
  const member = (
    await db
      .select()
      .from(issuerGroupMembers)
      .where(eq(issuerGroupMembers.id, memberId))
      .limit(1)
  )[0];
  if (!member) return;
  await db.delete(issuerGroupMembers).where(eq(issuerGroupMembers.id, memberId));
  await db
    .update(issuerGroups)
    .set({ updatedAt: new Date() })
    .where(eq(issuerGroups.id, member.groupId));
}

export async function deleteIssuerGroup(id: string) {
  await db.delete(issuerGroups).where(eq(issuerGroups.id, id));
}

export type FundWithHoldings = Fund & { holdings: FundHolding[] };
