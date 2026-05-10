import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { funds, memos, objections, reviews, type Memo } from "@/lib/db/schema";
import { listMemosForCio, listMemosForUser } from "@/lib/memos";
import { PageHeader } from "@/components/app-shell";
import { Badge, Button, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const FUND_TYPE_LABEL: Record<string, string> = {
  mf: "MF",
  pms: "PMS",
  aif: "AIF",
};

type ColumnTone = "neutral" | "warning" | "success" | "danger";

type Column = {
  key: Memo["status"];
  label: string;
  tone: ColumnTone;
  description: string;
};

const COLUMNS: Column[] = [
  {
    key: "draft",
    label: "Draft",
    tone: "neutral",
    description: "In progress — not yet submitted",
  },
  {
    key: "in_review",
    label: "In Review",
    tone: "warning",
    description: "Mandate is evaluating",
  },
  {
    key: "changes_requested",
    label: "Changes Requested",
    tone: "warning",
    description: "Address objections, then resubmit",
  },
  {
    key: "approved",
    label: "Approved",
    tone: "success",
    description: "Cleared review",
  },
  {
    key: "rejected",
    label: "Rejected",
    tone: "danger",
    description: "House View violation — premise must change",
  },
];

const COLUMN_BORDER: Record<ColumnTone, string> = {
  neutral: "border-border",
  warning: "border-[color-mix(in_oklab,var(--warning)_40%,var(--border))]",
  success: "border-[color-mix(in_oklab,var(--success)_40%,var(--border))]",
  danger: "border-[color-mix(in_oklab,var(--danger)_40%,var(--border))]",
};

export default async function ReviewPage() {
  const session = await auth();
  const userMemos = session
    ? await listMemosForUser(session.user.id)
    : await listMemosForCio();

  const memoIds = userMemos.map((m) => m.id);
  const fundIds = [
    ...new Set(userMemos.map((r) => r.fundId).filter((id): id is string => !!id)),
  ];

  const [fundRows, openCounts, recentDecisions] = await Promise.all([
    fundIds.length
      ? db.select().from(funds).where(inArray(funds.id, fundIds))
      : Promise.resolve([]),
    memoIds.length ? loadOpenObjectionCounts(memoIds) : Promise.resolve(new Map()),
    memoIds.length ? loadRecentDecisions(memoIds, 8) : Promise.resolve([]),
  ]);

  const fundById = new Map(fundRows.map((f) => [f.id, f]));
  const memosByStatus = new Map<Memo["status"], Memo[]>();
  for (const m of userMemos) {
    const list = memosByStatus.get(m.status) ?? [];
    list.push(m);
    memosByStatus.set(m.status, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Lifecycle"
        title="Review"
        description="Lifecycle of every memo. Mandate runs the binding review; you author and respond."
      />

      {userMemos.length === 0 ? (
        <EmptyState
          title="No memos yet"
          body="Author a thesis, stress-test it, then submit for binding review."
          action={
            <Link href="/memos/new">
              <Button size="sm">New memo</Button>
            </Link>
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = memosByStatus.get(col.key) ?? [];
          return (
            <div
              key={col.key}
              className={`flex flex-col gap-3 rounded-lg border bg-surface p-3 ${COLUMN_BORDER[col.tone]}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[11px] font-medium uppercase tracking-wider text-text">
                  {col.label}
                </h2>
                <Badge tone={col.tone}>{items.length}</Badge>
              </div>
              <p className="text-[11px] leading-snug text-text-subtle">
                {col.description}
              </p>
              <div className="flex flex-col gap-2">
                {items.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-text-subtle">
                    None
                  </div>
                ) : (
                  items.map((memo) => (
                    <MemoCard
                      key={memo.id}
                      memo={memo}
                      fund={memo.fundId ? fundById.get(memo.fundId) ?? null : null}
                      openCount={openCounts.get(memo.id) ?? 0}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ActivityStream activity={recentDecisions} />
    </div>
  );
}

function MemoCard({
  memo,
  fund,
  openCount,
}: {
  memo: Memo;
  fund: { name: string; type: string } | null;
  openCount: number;
}) {
  const heading =
    memo.entityType === "fund"
      ? fund
        ? `${FUND_TYPE_LABEL[fund.type] ?? fund.type} · ${fund.name}`
        : "(fund deleted)"
      : `${memo.stockTicker ?? ""} ${memo.stockName ?? ""}`.trim();
  const ageMs = Date.now() - memo.updatedAt.getTime();
  const ageLabel = formatAge(ageMs);
  return (
    <Link
      href={`/memos/${memo.id}`}
      className="group flex flex-col gap-1 rounded-md border border-border bg-surface-2 p-2 text-xs transition-colors hover:border-border-strong hover:bg-surface-3"
    >
      <span className="line-clamp-1 font-medium text-text">
        {heading || "Untitled"}
      </span>
      <p className="line-clamp-2 text-[11px] leading-snug text-text-muted">
        {memo.thesis}
      </p>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-text-subtle tabular-nums">
        <span>{ageLabel}</span>
        {openCount > 0 ? <Badge tone="warning">{openCount} open</Badge> : null}
      </div>
    </Link>
  );
}

type ActivityRow = {
  reviewId: string;
  memoId: string;
  decision: string | null;
  finishedAt: Date | null;
  confidence: number | null;
  stockTicker: string | null;
  stockName: string | null;
  fundName: string | null;
};

function ActivityStream({ activity }: { activity: ActivityRow[] }) {
  if (activity.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
        Recent Mandate activity
      </h2>
      <ul className="flex flex-col gap-2 text-xs">
        {activity.map((a, i) => (
          <li
            key={a.reviewId}
            className={`flex items-center justify-between gap-3 ${i < activity.length - 1 ? "border-b border-border pb-2" : ""}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <DecisionChip decision={a.decision} />
              <Link
                href={`/memos/${a.memoId}`}
                className="line-clamp-1 text-text transition-colors hover:text-accent"
              >
                {a.stockTicker
                  ? `${a.stockTicker} · ${a.stockName ?? ""}`
                  : (a.fundName ?? "Fund memo")}
              </Link>
              {a.confidence != null ? (
                <span className="font-mono text-[11px] text-text-subtle tabular-nums">
                  {a.confidence}% confidence
                </span>
              ) : null}
            </div>
            <span className="shrink-0 font-mono text-[11px] text-text-subtle tabular-nums">
              {a.finishedAt ? formatAge(Date.now() - a.finishedAt.getTime()) : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DecisionChip({ decision }: { decision: string | null }) {
  if (decision === "approved") {
    return <Badge tone="success" dot>approved</Badge>;
  }
  if (decision === "rejected") {
    return <Badge tone="danger" dot>rejected</Badge>;
  }
  if (decision === "changes_requested") {
    return <Badge tone="warning" dot>changes</Badge>;
  }
  return null;
}

function formatAge(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

async function loadOpenObjectionCounts(memoIds: string[]): Promise<Map<string, number>> {
  // For each memo, find its latest review's open objection count.
  const allReviews = await db
    .select()
    .from(reviews)
    .where(inArray(reviews.memoId, memoIds))
    .orderBy(desc(reviews.startedAt));
  const latestByMemo = new Map<string, string>();
  for (const r of allReviews) {
    if (!latestByMemo.has(r.memoId)) latestByMemo.set(r.memoId, r.id);
  }
  if (latestByMemo.size === 0) return new Map();
  const reviewIds = [...latestByMemo.values()];
  const allObjections = await db
    .select()
    .from(objections)
    .where(inArray(objections.reviewId, reviewIds));
  const openByReview = new Map<string, number>();
  for (const o of allObjections) {
    if (o.status !== "open") continue;
    openByReview.set(o.reviewId, (openByReview.get(o.reviewId) ?? 0) + 1);
  }
  const out = new Map<string, number>();
  for (const [memoId, reviewId] of latestByMemo) {
    out.set(memoId, openByReview.get(reviewId) ?? 0);
  }
  return out;
}

async function loadRecentDecisions(
  memoIds: string[],
  limit: number,
): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      reviewId: reviews.id,
      memoId: reviews.memoId,
      decision: reviews.decision,
      finishedAt: reviews.finishedAt,
      confidence: reviews.confidence,
      stockTicker: memos.stockTicker,
      stockName: memos.stockName,
      fundId: memos.fundId,
      entityType: memos.entityType,
    })
    .from(reviews)
    .innerJoin(memos, eq(memos.id, reviews.memoId))
    .where(inArray(reviews.memoId, memoIds))
    .orderBy(desc(reviews.finishedAt))
    .limit(limit);
  const fundIds = rows.map((r) => r.fundId).filter((id): id is string => !!id);
  const fundsList = fundIds.length
    ? await db.select().from(funds).where(inArray(funds.id, fundIds))
    : [];
  const fundNameById = new Map(fundsList.map((f) => [f.id, f.name]));
  return rows.map((r) => ({
    reviewId: r.reviewId,
    memoId: r.memoId,
    decision: r.decision,
    finishedAt: r.finishedAt,
    confidence: r.confidence,
    stockTicker: r.stockTicker,
    stockName: r.stockName,
    fundName: r.fundId ? (fundNameById.get(r.fundId) ?? null) : null,
  }));
}
