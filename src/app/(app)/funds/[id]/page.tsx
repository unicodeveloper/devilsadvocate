import Link from "next/link";
import { notFound } from "next/navigation";
import { getFundById, listHoldingsForFund } from "@/lib/funds";
import { formatUSD, toUSD } from "@/lib/fx";
import { Badge, EmptyState, KeyValue } from "@/components/ui";
import { HoldingsUploader } from "./holdings-uploader";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  mf: "Mutual Fund",
  pms: "PMS",
  aif: "AIF",
};

export default async function FundDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const fund = await getFundById(id);
  if (!fund) notFound();
  const holdings = await listHoldingsForFund(fund.id);

  const sectorMap = new Map<string, number>();
  let totalWeightX100 = 0;
  for (const h of holdings) {
    totalWeightX100 += h.weightPct;
    const key = h.sector?.trim() || "Unclassified";
    sectorMap.set(key, (sectorMap.get(key) ?? 0) + h.weightPct);
  }
  const sectorRows = [...sectorMap.entries()]
    .map(([sector, w]) => ({ sector, weightPct: w / 100 }))
    .sort((a, b) => b.weightPct - a.weightPct);
  const maxSectorWeight = sectorRows[0]?.weightPct ?? 0;

  const aumUsd = fund.aumNative ? toUSD(fund.aumNative, fund.currency) : null;
  const isNative = fund.currency && fund.currency !== "USD";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/funds"
          className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          All funds
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <Badge tone="neutral">
            {TYPE_LABEL[fund.type] ?? fund.type.toUpperCase()}
          </Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            {fund.name}
          </h1>
          {fund.currency ? (
            <Badge tone="info">{fund.currency}</Badge>
          ) : null}
        </div>

        {/* Metadata strip */}
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 rounded-lg border border-border bg-surface px-4 py-3">
          {fund.fundManager ? (
            <KeyValue label="Manager" value={fund.fundManager} mono={false} />
          ) : null}
          {fund.schemeCode ? (
            <KeyValue label="Scheme" value={fund.schemeCode} />
          ) : null}
          {aumUsd != null ? (
            <KeyValue
              label="AUM"
              value={
                <>
                  {formatUSD(aumUsd)}
                  {isNative && fund.aumNative ? (
                    <span className="ml-1.5 text-[11px] text-text-subtle">
                      ({fund.currency} {fund.aumNative.toLocaleString()})
                    </span>
                  ) : null}
                </>
              }
            />
          ) : null}
          <KeyValue
            label="Updated"
            value={fund.updatedAt.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
        </div>

        {fund.notes ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">
            {fund.notes}
          </p>
        ) : null}
      </div>

      <HoldingsUploader fundId={fund.id} />

      {holdings.length === 0 ? (
        <EmptyState
          title="No holdings yet"
          body="Upload a CSV above to populate this fund's positions and unlock cross-fund exposure analysis."
        />
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <SectionTitle>Sector breakdown</SectionTitle>
            <ul className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              {sectorRows.map((s) => {
                const width =
                  maxSectorWeight > 0 ? (s.weightPct / maxSectorWeight) * 100 : 0;
                return (
                  <li
                    key={s.sector}
                    className="grid grid-cols-[1fr_auto] items-center gap-3"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate text-text">{s.sector}</span>
                      </div>
                      <div
                        aria-hidden="true"
                        className="h-1 w-full overflow-hidden rounded-full bg-surface-3"
                      >
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-xs text-text-muted tabular-nums">
                      {s.weightPct.toFixed(2)}%
                    </span>
                  </li>
                );
              })}
              <li className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2.5 text-[11px] text-text-subtle">
                <span className="uppercase tracking-wider">Total weight</span>
                <span className="font-mono tabular-nums text-text">
                  {(totalWeightX100 / 100).toFixed(2)}%
                </span>
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <SectionTitle>
              <span>Holdings</span>
              <Badge tone="neutral" className="ml-2">
                {holdings.length}
              </Badge>
            </SectionTitle>
            <div className="overflow-hidden rounded-lg border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-[10px] font-medium uppercase tracking-wider text-text-subtle">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Ticker</th>
                    <th className="px-3 py-2.5 text-left">Name</th>
                    <th className="px-3 py-2.5 text-left">Sector</th>
                    <th className="px-3 py-2.5 text-right">Weight</th>
                    <th className="px-3 py-2.5 text-right">
                      Value{isNative ? ` (${fund.currency})` : " (USD)"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {holdings.map((h) => (
                    <tr
                      key={h.id}
                      className="transition-colors hover:bg-surface-2"
                    >
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-text">
                        {h.ticker}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-text-muted">
                        {h.name}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-text-subtle">
                        {h.sector ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-text tabular-nums">
                        {(h.weightPct / 100).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs text-text-muted tabular-nums">
                        {h.valueNative
                          ? isNative
                            ? h.valueNative.toLocaleString()
                            : formatUSD(h.valueNative)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center text-[11px] font-medium uppercase tracking-wider text-text-subtle">
      {children}
    </h2>
  );
}
