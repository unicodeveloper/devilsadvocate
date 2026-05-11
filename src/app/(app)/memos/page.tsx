import Link from "next/link";
import { inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { funds } from "@/lib/db/schema";
import {
  listExampleMemos,
  listMemosForCio,
  listMemosForUser,
} from "@/lib/memos";
import type { Memo } from "@/lib/db/schema";
import { PageHeader } from "@/components/app-shell";
import { Badge } from "@/components/ui";
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
  const isFm = session?.user.role === "fund_manager";
  const rows = isFm
    ? await listMemosForUser(session.user.id)
    : await listMemosForCio();
  const heading = session ? "Your memos" : "All memos";

  // For signed-in FMs with no memos, surface the seeded demos as inline
  // examples so the empty state is something to react to rather than a
  // dead-end. Skipped for unauthed visitors (they already see the CIO
  // view which includes the same memos) and skipped once the FM has any
  // memos of their own (so this is purely an onboarding moment).
  const examples =
    isFm && rows.length === 0 ? await listExampleMemos(3) : [];

  const fundIds = [
    ...new Set(
      [...rows, ...examples]
        .map((r) => r.fundId)
        .filter((id): id is string => !!id),
    ),
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
        description={`${rows.length} ${rows.length === 1 ? "memo" : "memos"} — Devil's Advocate has reviewed every submitted thesis against your House View.`}
        actions={!session || isFm ? <NewMemoButton /> : null}
      />

      {rows.length === 0 ? (
        <EmptyStateBlock
          examples={examples}
          fundById={fundById}
          showCreateLink={!session || isFm}
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

function EmptyStateBlock({
  examples,
  fundById,
  showCreateLink,
}: {
  examples: Memo[];
  fundById: Map<string, { name: string; type: string }>;
  showCreateLink: boolean;
}) {
  const hasExamples = examples.length > 0;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-10 text-center">
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"
        >
          <DocIcon />
        </span>
        <h2 className="text-base font-semibold tracking-tight text-text">
          Stress-test your first thesis
        </h2>
        <p className="max-w-md text-sm leading-6 text-text-muted">
          Submit a stock or fund and Devil&apos;s Advocate runs Bull, Bear,
          House View, and Synthesizer in parallel.
          {hasExamples ? " Or peek at how others read." : null}
        </p>
        {showCreateLink ? (
          <Link
            href="/memos/new"
            className="mt-1 text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            Create your first memo →
          </Link>
        ) : null}
      </div>

      {hasExamples ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
              Examples
            </h3>
            <span className="text-[11px] text-text-subtle">
              Read-only · ships with the app
            </span>
          </div>
          <ul className="overflow-hidden rounded-lg border border-border bg-surface">
            {examples.map((memo, idx) => {
              const status = STATUS_TONE[memo.status] ?? STATUS_TONE.draft;
              return (
                <li
                  key={memo.id}
                  className={idx > 0 ? "border-t border-border" : undefined}
                >
                  <Link
                    href={`/memos/${memo.id}`}
                    className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <MemoHeading
                          memo={memo}
                          fundName={fundLabel(memo, fundById)}
                        />
                        <ExampleBadge />
                      </div>
                      <p className="line-clamp-1 text-xs text-text-muted">
                        {memo.thesis}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                      <ChevronRight />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ExampleBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
      <span
        aria-hidden="true"
        className="inline-block h-1 w-1 rounded-full bg-accent shadow-[0_0_6px_var(--accent)]"
      />
      Example
    </span>
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
