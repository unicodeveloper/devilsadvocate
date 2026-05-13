import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  EDITABLE_STATUSES,
  getMemoById,
  getLatestCompletedRun,
  listRunsForMemo,
  parseFundSynthesizedMemo,
  parsePrivateCompanySynthesizedMemo,
  parseSynthesizedMemo,
} from "@/lib/memos";
import { getLatestReview, loadReviewWithObjections } from "@/lib/reviews";
import { getFundById } from "@/lib/funds";
import { RunPanel } from "@/components/run-panel";
import { MemoView } from "@/components/memo-view";
import { FundMemoView } from "@/components/fund-memo-view";
import { PrivateCompanyMemoView } from "@/components/private-company-memo-view";
import { Badge, EmptyState } from "@/components/ui";
import { DraftFields } from "./draft-fields";
import { RunHistory } from "./run-history";
import { ReviewRail } from "./review-rail";
import { SectionBadge } from "./section-badge";
import type {
  FundSynthesizedMemo,
  PrivateCompanySynthesizedMemo,
  SynthesizedMemo,
} from "@/lib/agents/types";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<
  string,
  { tone: "neutral" | "warning" | "success" | "danger"; label: string }
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

export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const memo = await getMemoById(id);
  if (!memo) notFound();
  // Non-drafts are readable by anyone (lets signed-in FMs click through to
  // example memos seeded by the demo user). Drafts stay private to the
  // owning FM.
  const isOwner = session?.user.id === memo.createdByUserId;
  if (!isOwner && memo.status === "draft") notFound();

  const [latestRun, fund, allRuns, latestReviewRow] = await Promise.all([
    getLatestCompletedRun(memo.id),
    memo.fundId ? getFundById(memo.fundId) : Promise.resolve(null),
    listRunsForMemo(memo.id),
    getLatestReview(memo.id),
  ]);
  const latestReview = latestReviewRow
    ? await loadReviewWithObjections(latestReviewRow.id)
    : null;

  const synthesized:
    | SynthesizedMemo
    | FundSynthesizedMemo
    | PrivateCompanySynthesizedMemo
    | null =
    memo.entityType === "fund"
      ? parseFundSynthesizedMemo(latestRun?.synthesizedMemoJson ?? null)
      : memo.entityType === "private_company"
        ? parsePrivateCompanySynthesizedMemo(
            latestRun?.synthesizedMemoJson ?? null,
          )
        : parseSynthesizedMemo(latestRun?.synthesizedMemoJson ?? null);

  const hasCompletedRun = Boolean(latestRun);
  const isEditable = isOwner && EDITABLE_STATUSES.has(memo.status as never);
  const bearFindingCount = synthesized?.stressTest?.findings?.length ?? 0;
  const status = STATUS_TONE[memo.status] ?? STATUS_TONE.draft;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/memos"
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
          All memos
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          {memo.entityType === "fund" ? (
            <>
              <Badge tone="neutral">
                {fund ? FUND_TYPE_LABEL[fund.type] ?? fund.type : "FUND"}
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-text">
                {fund?.name ?? "(fund deleted)"}
              </h1>
            </>
          ) : memo.entityType === "private_company" ? (
            <>
              <Badge tone="neutral">
                {memo.privateCompanyRoundStage === "series_b"
                  ? "SERIES B"
                  : memo.privateCompanyRoundStage === "series_a"
                    ? "SERIES A"
                    : "SEED"}
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-text">
                {memo.privateCompanyName ?? "(private company)"}
              </h1>
              {memo.privateCompanySector ? (
                <Badge tone="neutral">{memo.privateCompanySector}</Badge>
              ) : null}
            </>
          ) : (
            <>
              <h1 className="font-mono text-2xl font-semibold tracking-tight text-text">
                {memo.stockTicker}
              </h1>
              <span className="text-xl font-medium text-text-muted">
                {memo.stockName}
              </span>
              {memo.stockSector ? (
                <Badge tone="neutral">{memo.stockSector}</Badge>
              ) : null}
            </>
          )}
          <Badge tone={status.tone} dot>
            {status.label}
          </Badge>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-subtle tabular-nums">
          <span>
            <span className="text-text-subtle">Created</span>{" "}
            <span className="text-text-muted">
              {memo.createdAt.toLocaleString()}
            </span>
          </span>
          {latestRun?.finishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                <span className="text-text-subtle">Last stress-test</span>{" "}
                <span className="text-text-muted">
                  {latestRun.finishedAt.toLocaleString()}
                </span>
              </span>
            </>
          ) : null}
          {latestReview?.finishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                <span className="text-text-subtle">Last review</span>{" "}
                <span className="text-text-muted">
                  {latestReview.finishedAt.toLocaleString()}
                </span>
              </span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <Link
            href={`/memos/${memo.id}/audit`}
            className="text-text-muted transition-colors hover:text-text"
          >
            Audit trail
          </Link>
          {hasCompletedRun ? (
            <>
              <span aria-hidden="true">·</span>
              <a
                href={`/api/memos/${memo.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-text-muted transition-colors hover:text-text"
              >
                Download PDF
              </a>
            </>
          ) : null}
          {memo.entityType === "fund" && fund ? (
            <>
              <span aria-hidden="true">·</span>
              <Link
                href={`/funds/${fund.id}`}
                className="text-text-muted transition-colors hover:text-text"
              >
                Fund details
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {isEditable ? (
            <DraftFields
              memoId={memo.id}
              initialThesis={memo.thesis}
              initialAreasOfConcern={memo.areasOfConcern}
              initialPrivatePeers={memo.privatePeers}
              entityType={memo.entityType}
              objections={latestReview?.objections ?? []}
            />
          ) : (
            <>
              <Section
                title="Thesis"
                badge={
                  <SectionBadge
                    section="thesis"
                    objections={latestReview?.objections ?? []}
                  />
                }
              >
                <p>{memo.thesis}</p>
              </Section>
              {memo.areasOfConcern ? (
                <Section
                  title="Areas of concern"
                  badge={
                    <SectionBadge
                      section="areas_of_concern"
                      objections={latestReview?.objections ?? []}
                    />
                  }
                >
                  <p>{memo.areasOfConcern}</p>
                </Section>
              ) : null}
              {memo.entityType === "stock" && memo.privatePeers ? (
                <Section
                  title="Private competitors"
                  badge={
                    <SectionBadge
                      section="private_peers"
                      objections={latestReview?.objections ?? []}
                    />
                  }
                >
                  <p>{memo.privatePeers}</p>
                </Section>
              ) : null}
            </>
          )}

          <RunHistory memoId={memo.id} runs={allRuns} />

          <section>
            <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
              Stress-test
            </h2>
            {isOwner ? (
              <RunPanel
                key={memo.id}
                memoId={memo.id}
                entityType={memo.entityType}
                initialMemo={synthesized}
              />
            ) : synthesized ? (
              memo.entityType === "fund" ? (
                <FundMemoView memo={synthesized as FundSynthesizedMemo} />
              ) : memo.entityType === "private_company" ? (
                <PrivateCompanyMemoView
                  memo={synthesized as PrivateCompanySynthesizedMemo}
                />
              ) : (
                <MemoView memo={synthesized as SynthesizedMemo} />
              )
            ) : (
              <EmptyState
                title="No stress-test yet"
                body="The author hasn't run the multi-agent stress-test on this memo."
              />
            )}
          </section>
        </div>

        {isOwner ? (
          <ReviewRail
            memoId={memo.id}
            memoStatus={memo.status as never}
            hasCompletedRun={hasCompletedRun}
            review={latestReview}
            bearFindingCount={bearFindingCount}
            hasPdf={hasCompletedRun}
            memoUpdatedAt={memo.updatedAt ?? null}
            lastRunFinishedAt={latestRun?.finishedAt ?? null}
          />
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          {title}
        </h2>
        {badge}
      </div>
      <div className="rounded-lg border border-border bg-surface p-4 text-sm leading-6 text-text">
        {children}
      </div>
    </section>
  );
}
