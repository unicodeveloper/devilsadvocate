"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { submitForReviewAction } from "./actions";
import { ObjectionCard } from "./objection-card";
import {
  canResubmit,
  summarizeObjections,
  type LoadedReview,
} from "@/lib/reviews-shared";
import { Badge, Button } from "@/components/ui";
import type { ComponentProps } from "react";

type MemoStatus =
  | "draft"
  | "in_review"
  | "changes_requested"
  | "approved"
  | "rejected";

type RailProps = {
  memoId: string;
  memoStatus: MemoStatus;
  hasCompletedRun: boolean;
  review: LoadedReview | null;
  bearFindingCount: number;
  hasPdf: boolean;
  memoUpdatedAt: Date | null;
  lastRunFinishedAt: Date | null;
};

const ENGINE_LABEL = "Devil's Advocate · v1.0.0";
type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

export function ReviewRail(props: RailProps) {
  const { memoStatus, hasCompletedRun, review } = props;

  return (
    <aside className="sticky top-20 flex w-full flex-col gap-4 self-start rounded-lg border border-border bg-surface p-4 text-sm shadow-sm lg:w-[360px]">
      {memoStatus === "draft" && !hasCompletedRun ? <DraftBlock {...props} /> : null}
      {memoStatus === "draft" && hasCompletedRun ? <StressTestedBlock {...props} /> : null}
      {memoStatus === "in_review" ? <InReviewBlock {...props} /> : null}
      {memoStatus === "changes_requested" && review ? (
        <VerdictBlock {...props} review={review} />
      ) : null}
      {memoStatus === "approved" && review ? <VerdictBlock {...props} review={review} /> : null}
      {memoStatus === "rejected" && review ? <VerdictBlock {...props} review={review} /> : null}
      {(memoStatus === "approved" || memoStatus === "rejected") && !review ? (
        <LegacyDecisionBlock memoStatus={memoStatus} memoId={props.memoId} />
      ) : null}
    </aside>
  );
}

function RailHeader({
  label,
  tone,
  subtitle,
}: {
  label: string;
  tone: BadgeTone;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Badge tone={tone} dot className="self-start">
        {label}
      </Badge>
      {subtitle ? (
        <span className="text-[11px] text-text-subtle">{subtitle}</span>
      ) : null}
    </div>
  );
}

function DraftBlock({ hasCompletedRun }: RailProps) {
  return (
    <>
      <RailHeader label="Draft" tone="neutral" subtitle="Not yet stress-tested" />
      <p className="text-xs leading-5 text-text-muted">
        Run a <span className="font-medium text-text">stress-test</span> first
        — Devil&apos;s Advocate reuses its outputs for binding review.
      </p>
      <ul className="flex flex-col gap-1.5">
        <ChecklistItem ok={false} label="Stress-test the thesis" />
        <ChecklistItem ok={hasCompletedRun} label="Submit for binding review" />
      </ul>
    </>
  );
}

function StressTestedBlock(props: RailProps) {
  return (
    <>
      <RailHeader label="Stress-tested" tone="info" subtitle="Ready to submit" />
      <p className="text-xs leading-5 text-text-muted">
        Stress-test surfaced{" "}
        <span className="font-medium text-text">
          {props.bearFindingCount} advisory note
          {props.bearFindingCount === 1 ? "" : "s"}
        </span>
        . Submitting now runs the binding Devil&apos;s Advocate review:
      </p>
      <ul className="flex flex-col gap-1 text-[11px] leading-5 text-text-subtle">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-text-subtle" />
          <span>
            <span className="text-text-muted">Stage 1</span> — House View hard rules
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-text-subtle" />
          <span>
            <span className="text-text-muted">Stage 2</span> — Bear advocate findings, consensus divergence, blind spots
          </span>
        </li>
      </ul>
      <SubmitButton memoId={props.memoId} label="Submit for review" />
    </>
  );
}

function InReviewBlock(props: RailProps) {
  return (
    <>
      <RailHeader label="Reviewing…" tone="warning" subtitle={ENGINE_LABEL} />
      <p className="text-xs leading-5 text-text-muted">
        Devil&apos;s Advocate is evaluating this memo. This usually takes a few seconds.
      </p>
      <ul className="flex flex-col gap-1 text-[11px] leading-5 text-text-subtle">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-text-subtle" />
          <span>
            <span className="text-text-muted">Stage 1</span> — House View hard rules
          </span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-block h-1 w-1 rounded-full bg-text-subtle" />
          <span>
            <span className="text-text-muted">Stage 2</span> — Soft checks &amp; deep research
          </span>
        </li>
      </ul>
      <SubmitButton memoId={props.memoId} label="Retry review" variant="outline" />
    </>
  );
}

function VerdictBlock({
  review,
  memoStatus,
  memoId,
  hasPdf,
  memoUpdatedAt,
  lastRunFinishedAt,
}: RailProps & { review: LoadedReview }) {
  const summary = summarizeObjections(review.objections);
  const decision = review.decision ?? "changes_requested";
  const tone: BadgeTone =
    decision === "approved" ? "success" : decision === "rejected" ? "danger" : "warning";
  const label =
    decision === "approved"
      ? "Approved"
      : decision === "rejected"
        ? "Rejected"
        : "Changes Requested";
  const confidence = review.confidence != null ? `${review.confidence}% confidence` : null;
  const ready = canResubmit(review.objections);

  return (
    <>
      <RailHeader
        label={label}
        tone={tone}
        subtitle={[ENGINE_LABEL, confidence].filter(Boolean).join(" · ")}
      />

      {review.summary ? (
        <p className="text-xs leading-5 text-text">{review.summary}</p>
      ) : null}

      {memoStatus === "rejected" ? (
        <div className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft p-3 text-[11px] leading-5 text-danger">
          A rejection means this thesis can&apos;t ship without revising the
          underlying premise (different ticker, or propose a House View change).
        </div>
      ) : null}

      {review.objections.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {summary.blocking ? (
              <Badge tone="danger">{summary.blocking} blocking</Badge>
            ) : null}
            {summary.major ? (
              <Badge tone="warning">{summary.major} major</Badge>
            ) : null}
            {summary.minor ? (
              <Badge tone="info">{summary.minor} minor</Badge>
            ) : null}
            {summary.disputed ? (
              <Badge tone="purple">{summary.disputed} disputed</Badge>
            ) : null}
            {summary.resolved ? (
              <Badge tone="success">{summary.resolved} resolved</Badge>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            {review.objections.map((o) => (
              <ObjectionCard key={o.id} objection={o} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs italic text-text-subtle">
          No objections raised. {decision === "approved" ? "Clear to ship." : null}
        </p>
      )}

      {decision === "changes_requested" || decision === "rejected" ? (
        <ResubmitButton
          memoId={memoId}
          label={ready ? "Resubmit" : `Address ${summary.blocking + summary.major} blocking/major first`}
          disabled={!ready}
          memoUpdatedAt={memoUpdatedAt}
          lastRunFinishedAt={lastRunFinishedAt}
          lastReviewFinishedAt={review.finishedAt ?? null}
        />
      ) : null}

      {decision === "approved" && hasPdf ? (
        <Link
          href={`/api/memos/${memoId}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-accent px-3.5 text-xs font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download IC PDF
        </Link>
      ) : null}
    </>
  );
}

function LegacyDecisionBlock({
  memoStatus,
  memoId,
}: {
  memoStatus: "approved" | "rejected";
  memoId: string;
}) {
  const tone: BadgeTone = memoStatus === "approved" ? "success" : "danger";
  const label = memoStatus === "approved" ? "Approved" : "Rejected";
  return (
    <>
      <RailHeader label={label} tone={tone} subtitle="Legacy decision" />
      <p className="text-xs leading-5 text-text-muted">
        This memo was decided before Devil&apos;s Advocate was wired up. Run a fresh review
        to migrate it.
      </p>
      <SubmitButton memoId={memoId} label="Run review now" />
    </>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        aria-hidden="true"
        className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
          ok
            ? "border-success bg-success-soft text-success"
            : "border-border text-text-subtle"
        }`}
      >
        {ok ? (
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>
      <span className={ok ? "text-text" : "text-text-muted"}>{label}</span>
    </li>
  );
}

function ResubmitButton({
  memoId,
  label,
  disabled,
  memoUpdatedAt,
  lastRunFinishedAt,
  lastReviewFinishedAt,
}: {
  memoId: string;
  label: string;
  disabled?: boolean;
  memoUpdatedAt: Date | null;
  lastRunFinishedAt: Date | null;
  lastReviewFinishedAt: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isPending]);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await submitForReviewAction(memoId);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submit failed");
      }
    });
  }

  const staleStressTest =
    lastReviewFinishedAt != null &&
    lastRunFinishedAt != null &&
    lastRunFinishedAt.getTime() <= lastReviewFinishedAt.getTime();

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={() => setOpen(true)} disabled={disabled || isPending} size="md">
        {label}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="resubmit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={() => {
              if (!isPending) setOpen(false);
            }}
          />
          <div className="relative w-full max-w-md rounded-lg border border-border bg-surface p-5 text-sm shadow-lg">
            <h2
              id="resubmit-modal-title"
              className="text-base font-semibold tracking-tight text-text"
            >
              Resubmit for binding review?
            </h2>
            <p className="mt-2 text-xs leading-5 text-text-muted">
              Devil&apos;s Advocate re-evaluates the latest stress-test output, not your
              Resolved/Disputed checkboxes. If the stress-test hasn&apos;t been
              re-run, expect similar objections.
            </p>

            <dl className="mt-4 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2 text-xs">
              <dt className="text-text-subtle">Memo last edited</dt>
              <dd className="font-mono text-text tabular-nums">
                {memoUpdatedAt ? memoUpdatedAt.toLocaleString() : "—"}
              </dd>
              <dt className="text-text-subtle">Last stress-test</dt>
              <dd className="font-mono text-text tabular-nums">
                {lastRunFinishedAt ? lastRunFinishedAt.toLocaleString() : "—"}
              </dd>
              <dt className="text-text-subtle">Last review</dt>
              <dd className="font-mono text-text tabular-nums">
                {lastReviewFinishedAt
                  ? lastReviewFinishedAt.toLocaleString()
                  : "—"}
              </dd>
            </dl>

            {staleStressTest ? (
              <div className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-warning-soft p-3 text-[11px] leading-5 text-warning">
                <span className="font-medium">
                  ⚠ Stress-test hasn&apos;t been re-run since the last review.
                </span>{" "}
                Devil&apos;s Advocate will see identical inputs and is likely to raise the
                same objections. Consider editing the memo and re-running the
                stress-test before resubmitting.
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 text-[11px] text-danger">{error}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={onConfirm}
                disabled={isPending}
                loading={isPending}
              >
                {isPending ? "Running review…" : "Resubmit (re-run review)"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SubmitButton({
  memoId,
  label,
  disabled,
  variant = "primary",
}: {
  memoId: string;
  label: string;
  disabled?: boolean;
  variant?: "primary" | "outline";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await submitForReviewAction(memoId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submit failed");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={variant}
        onClick={onSubmit}
        disabled={disabled || isPending}
        loading={isPending}
      >
        {isPending ? "Running review…" : label}
      </Button>
      {error ? <span className="text-[11px] text-danger">{error}</span> : null}
    </div>
  );
}
