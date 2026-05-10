import Link from "next/link";
import {
  aggregateExposureByGroupId,
  aggregateExposureBySector,
  aggregateExposureByTickerList,
  getIssuerGroupWithMembers,
  listAllSectorsInUse,
  listAllTickersInUse,
  listIssuerGroupsWithCounts,
  type ExposureResult,
} from "@/lib/funds";
import { formatUSD, fxAsOf } from "@/lib/fx";
import { PageHeader } from "@/components/app-shell";
import { Badge, EmptyState } from "@/components/ui";
import { ExposureForm, type QueryType } from "./exposure-form";

export const dynamic = "force-dynamic";

const FUND_TYPE_LABEL: Record<string, string> = {
  mf: "MF",
  pms: "PMS",
  aif: "AIF",
};

type SearchParams = { type?: string; q?: string; id?: string };

function isQueryType(v: string | undefined): v is QueryType {
  return v === "ticker" || v === "sector" || v === "group";
}

export default async function ExposurePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const type: QueryType = isQueryType(sp.type) ? sp.type : "ticker";
  const q = sp.q ?? "";
  const id = sp.id ?? "";

  const [sectors, groups, tickers] = await Promise.all([
    listAllSectorsInUse(),
    listIssuerGroupsWithCounts(),
    listAllTickersInUse(),
  ]);

  let result: ExposureResult | null = null;
  let queryLabel: string | null = null;
  let groupMemberTickers: string[] = [];

  if (type === "ticker" && q) {
    result = await aggregateExposureByTickerList([q.toUpperCase()]);
    queryLabel = q.toUpperCase();
  } else if (type === "sector" && q) {
    result = await aggregateExposureBySector(q);
    queryLabel = q;
  } else if (type === "group" && id) {
    const g = await getIssuerGroupWithMembers(id);
    if (g) {
      result = await aggregateExposureByGroupId(id);
      queryLabel = g.name;
      groupMemberTickers = g.members.map((m) => m.ticker);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cross-fund analysis"
        title="Exposure"
        description="Aggregate weighted exposure across every tracked fund — by ticker, sector, or issuer group. Multi-currency funds normalise to USD."
        actions={
          <Link
            href="/groups"
            className="text-xs font-medium text-text-muted transition-colors hover:text-text"
          >
            Manage groups →
          </Link>
        }
      />

      <ExposureForm
        initialType={type}
        initialQ={q}
        initialId={id}
        sectors={sectors}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberCount: g.memberCount,
        }))}
        knownTickers={tickers.map((t) => ({ ticker: t.ticker, name: t.name }))}
      />

      {result ? (
        <ResultPanel
          type={type}
          queryLabel={queryLabel ?? ""}
          result={result}
          groupMemberTickers={groupMemberTickers}
        />
      ) : (
        <EmptyState
          icon={<SearchIcon />}
          title="Run a query above"
          body="Pick a ticker, sector, or issuer group and search to see weighted exposure across every fund holding that name."
        />
      )}
    </div>
  );
}

function ResultPanel({
  type,
  queryLabel,
  result,
  groupMemberTickers,
}: {
  type: QueryType;
  queryLabel: string;
  result: ExposureResult;
  groupMemberTickers: string[];
}) {
  const totalUsd = result.totalWeightedAumUsd;
  const empty = result.perFund.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          <span>Aggregate exposure</span>
          <span className="text-text-subtle">·</span>
          <Badge tone="accent">
            {type === "ticker"
              ? queryLabel
              : `${type.toUpperCase()} · ${queryLabel}`}
          </Badge>
        </div>
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-mono text-3xl font-semibold tracking-tight text-text tabular-nums">
            {totalUsd > 0 ? formatUSD(totalUsd) : "—"}
          </span>
          <span className="text-sm text-text-muted">
            across {result.totalFundsAffected} fund
            {result.totalFundsAffected === 1 ? "" : "s"}
          </span>
        </div>
        {totalUsd > 0 ? (
          <p className="mt-2 text-[11px] text-text-subtle">
            Multi-currency funds normalised to USD at FX as of {fxAsOf()}.
          </p>
        ) : null}
        {totalUsd === 0 && result.totalFundsAffected > 0 ? (
          <p className="mt-2 text-xs text-text-muted">
            Exposure value not computed — none of the matching funds have AUM
            recorded.
          </p>
        ) : null}
      </div>

      {empty ? (
        <EmptyState
          title="No matches"
          body="No fund holds anything matching this query. Try a different ticker, sector, or group."
        />
      ) : (
        <>
          {type === "group" ? (
            <section className="flex flex-col gap-3">
              <SectionTitle subtitle="how each member contributes">
                Group composition
              </SectionTitle>
              {result.byMember.length === 0 ? (
                <p className="text-xs text-text-muted">
                  Group has {groupMemberTickers.length} ticker
                  {groupMemberTickers.length === 1 ? "" : "s"} but none appear
                  in any fund yet.
                </p>
              ) : (
                <DataTable>
                  <TableHead>
                    <th className="px-3 py-2.5 text-left">Ticker</th>
                    <th className="px-3 py-2.5 text-left">Name</th>
                    <th className="px-3 py-2.5 text-right">
                      Total weight (sum)
                    </th>
                    <th className="px-3 py-2.5 text-right">In # funds</th>
                  </TableHead>
                  <tbody className="divide-y divide-border">
                    {result.byMember.map((m) => (
                      <tr
                        key={m.ticker}
                        className="transition-colors hover:bg-surface-2"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs font-semibold text-text">
                          {m.ticker}
                        </td>
                        <td className="px-3 py-2.5 text-sm text-text-muted">
                          {m.name}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-text tabular-nums">
                          {m.totalWeightPctAcrossFunds.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted tabular-nums">
                          {m.fundCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <SectionTitle>Per-fund breakdown</SectionTitle>
            <DataTable>
              <TableHead>
                <th className="px-3 py-2.5 text-left">Fund</th>
                <th className="px-3 py-2.5 text-left">Type</th>
                <th className="px-3 py-2.5 text-right">Weight in fund</th>
                <th className="px-3 py-2.5 text-right">Value (USD)</th>
                <th className="px-3 py-2.5 text-right">As of</th>
              </TableHead>
              <tbody className="divide-y divide-border">
                {result.perFund.map((r) => (
                  <tr
                    key={r.fundId}
                    className="transition-colors hover:bg-surface-2"
                  >
                    <td className="px-3 py-2.5 text-sm">
                      <Link
                        href={`/funds/${r.fundId}`}
                        className="text-text underline-offset-4 hover:text-accent hover:underline"
                      >
                        {r.fundName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone="neutral">
                        {FUND_TYPE_LABEL[r.fundType] ?? r.fundType.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-text tabular-nums">
                      {r.weightPct.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-sm text-text tabular-nums">
                      {r.valueUsd != null ? formatUSD(r.valueUsd) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-text-subtle tabular-nums">
                      {r.asOfDate
                        ? r.asOfDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>
        </>
      )}
    </div>
  );
}

function DataTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-2 text-[10px] font-medium uppercase tracking-wider text-text-subtle">
      <tr>{children}</tr>
    </thead>
  );
}

function SectionTitle({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
        {children}
      </h2>
      {subtitle ? (
        <span className="text-[11px] text-text-subtle">· {subtitle}</span>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
