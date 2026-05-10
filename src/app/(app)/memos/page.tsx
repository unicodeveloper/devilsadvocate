import Link from "next/link";
import { inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { funds } from "@/lib/db/schema";
import { listMemosForCio, listMemosForUser } from "@/lib/memos";
import type { Memo } from "@/lib/db/schema";
import { PageHeader } from "@/components/app-shell";
import { Badge, EmptyState } from "@/components/ui";
import { NewMemoButton } from "./new-memo-button";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<
  string,
  { tone: "neutral" | "warning" | "success" | "danger" | "accent"; label: string }
> = {
  draft: { tone: "neutral", label: "Draft" },
  in_review: { tone: "warning", label: "In review" },
  changes_requested: { tone: "warning", label: "Changes requested" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
};

const FUND_TYPE_LABEL: Record<string, string> = {
  mf: "MF",
  pms: "PMS",
  aif: "AIF",
};

export default async function MemosPage() {
  const session = await auth();
  const rows = session
    ? await listMemosForUser(session.user.id)
    : await listMemosForCio();
  const isFm = Boolean(session);
  const heading = session ? "Your memos" : "All memos";

  const fundIds = [
    ...new Set(rows.map((r) => r.fundId).filter((id): id is string => !!id)),
  ];
  const fundRows =
    fundIds.length > 0
      ? await db.select().from(funds).where(inArray(funds.id, fundIds))
      : [];
  const fundById = new Map(fundRows.map((f) => [f.id, f]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={heading}
        description={`${rows.length} ${rows.length === 1 ? "memo" : "memos"} — Mandate has reviewed every submitted thesis against your House View.`}
        actions={!session || isFm ? <NewMemoButton /> : null}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<DocIcon />}
          title="No memos yet"
          body="Stress-test a stock or fund thesis. Mandate runs Bull Advocate, Bear Advocate, House View Checker, and Synthesizer in parallel."
          action={
            !session || isFm ? (
              <Link
                href="/memos/new"
                className="text-xs font-medium text-accent underline-offset-4 hover:underline"
              >
                Create your first memo →
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-surface">
          {rows.map((memo, idx) => {
            const status = STATUS_TONE[memo.status] ?? STATUS_TONE.draft;
            return (
              <li
                key={memo.id}
                className={
                  idx > 0 ? "border-t border-border" : undefined
                }
              >
                <Link
                  href={`/memos/${memo.id}`}
                  className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <MemoHeading
                      memo={memo}
                      fundName={fundLabel(memo, fundById)}
                    />
                    <p className="line-clamp-1 text-xs text-text-muted">
                      {memo.thesis}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge tone={status.tone} dot>
                      {status.label}
                    </Badge>
                    <span className="hidden font-mono text-[11px] text-text-subtle tabular-nums sm:inline">
                      {memo.updatedAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
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

function fundLabel(
  memo: Memo,
  fundById: Map<string, { name: string; type: string }>,
): string | null {
  if (memo.entityType !== "fund" || !memo.fundId) return null;
  const f = fundById.get(memo.fundId);
  if (!f) return "(fund deleted)";
  return `${FUND_TYPE_LABEL[f.type] ?? f.type} · ${f.name}`;
}

function MemoHeading({
  memo,
  fundName,
}: {
  memo: Memo;
  fundName: string | null;
}) {
  if (memo.entityType === "fund") {
    return (
      <div className="flex items-baseline gap-2">
        <span className="rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
          Fund
        </span>
        <span className="truncate text-sm font-medium text-text">
          {fundName ?? "(fund)"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="font-mono text-[13px] font-semibold tracking-tight text-text">
        {memo.stockTicker}
      </span>
      <span className="truncate text-sm text-text-muted">
        {memo.stockName}
      </span>
    </div>
  );
}

function DocIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
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
