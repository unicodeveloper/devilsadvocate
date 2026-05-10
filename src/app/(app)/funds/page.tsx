import Link from "next/link";
import { listFunds } from "@/lib/funds";
import { PageHeader } from "@/components/app-shell";
import { Badge, Button, EmptyState } from "@/components/ui";
import { formatUSD, toUSD } from "@/lib/fx";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  mf: "Mutual Fund",
  pms: "PMS",
  aif: "AIF",
};

export default async function FundsPage() {
  const rows = await listFunds();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Portfolio universe"
        title="Funds"
        description={
          rows.length === 0
            ? "Track funds and their holdings to power exposure analysis."
            : `${rows.length} ${rows.length === 1 ? "fund" : "funds"} ingested. Holdings update on monthly CSV upload.`
        }
        actions={
          <Link href="/funds/new">
            <Button
              iconLeft={
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              }
            >
              Add fund
            </Button>
          </Link>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<FundIcon />}
          title="No funds yet"
          body="Add a fund to start tracking holdings, sector concentration, and cross-fund exposure to any ticker or issuer group."
          action={
            <Link
              href="/funds/new"
              className="text-xs font-medium text-accent underline-offset-4 hover:underline"
            >
              Add your first fund →
            </Link>
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {rows.map((f, idx) => {
            const aumUsd = f.aumNative ? toUSD(f.aumNative, f.currency) : null;
            return (
              <li
                key={f.id}
                className={idx > 0 ? "border-t border-border" : undefined}
              >
                <Link
                  href={`/funds/${f.id}`}
                  className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-baseline gap-2">
                      <Badge tone="neutral">
                        {TYPE_LABEL[f.type] ?? f.type.toUpperCase()}
                      </Badge>
                      <span className="truncate text-sm font-medium text-text">
                        {f.name}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-xs text-text-muted">
                      {[
                        f.fundManager ? `Manager: ${f.fundManager}` : null,
                        f.schemeCode ? `Scheme ${f.schemeCode}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    {aumUsd != null ? (
                      <div className="hidden flex-col items-end gap-0.5 sm:flex">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">
                          AUM
                        </span>
                        <span className="font-mono text-sm font-medium text-text tabular-nums">
                          {formatUSD(aumUsd)}
                        </span>
                      </div>
                    ) : null}
                    <span className="hidden font-mono text-[11px] text-text-subtle tabular-nums md:inline">
                      {f.asOfDate
                        ? f.asOfDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "2-digit",
                          })
                        : "—"}
                    </span>
                    <ChevronRight />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FundIcon() {
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
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-text-muted"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
