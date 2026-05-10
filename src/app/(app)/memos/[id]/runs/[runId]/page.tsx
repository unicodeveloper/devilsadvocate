import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMemoById,
  getRunById,
  parseFundSynthesizedMemo,
  parseSynthesizedMemo,
} from "@/lib/memos";
import { MemoView } from "@/components/memo-view";
import { FundMemoView } from "@/components/fund-memo-view";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function BackLink({ memoId }: { memoId: string }) {
  return (
    <Link
      href={`/memos/${memoId}`}
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
      Back to memo
    </Link>
  );
}

export default async function RunViewerPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const session = await auth();
  const { id, runId } = await params;
  const memo = await getMemoById(
    id,
    session?.user.role === "fund_manager"
      ? { ownerId: session.user.id }
      : undefined,
  );
  if (!memo) notFound();
  if (session?.user.role !== "fund_manager" && memo.status === "draft") notFound();

  const run = await getRunById(runId);
  if (!run || run.memoId !== memo.id) notFound();

  if (run.status !== "completed") {
    return (
      <div className="flex flex-col gap-4">
        <BackLink memoId={memo.id} />
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          Run snapshot
        </h1>
        <div className="rounded-lg border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-warning-soft p-4 text-sm leading-6 text-warning">
          <p>
            This run has status <strong>{run.status}</strong>, so there&apos;s no
            synthesized memo to display.
          </p>
          {run.errorMessage ? (
            <p className="mt-2 font-mono text-[11px]">{run.errorMessage}</p>
          ) : null}
        </div>
      </div>
    );
  }

  const synthesized =
    memo.entityType === "fund"
      ? parseFundSynthesizedMemo(run.synthesizedMemoJson)
      : parseSynthesizedMemo(run.synthesizedMemoJson);

  if (!synthesized) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink memoId={memo.id} />
        <EmptyState
          title="Synthesized memo could not be parsed"
          body="The stored output for this run is not in the expected schema."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink memoId={memo.id} />
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Past run snapshot
          </h1>
          <Badge tone="neutral">historical</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-subtle tabular-nums">
          <span>
            <span className="text-text-subtle">Run</span>{" "}
            <span className="font-mono text-text">{run.id.slice(0, 8)}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <span className="text-text-subtle">Started</span>{" "}
            <span className="text-text-muted">
              {run.startedAt.toLocaleString()}
            </span>
          </span>
          {run.finishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                <span className="text-text-subtle">Finished</span>{" "}
                <span className="text-text-muted">
                  {run.finishedAt.toLocaleString()}
                </span>
              </span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <Link
            href={`/memos/${memo.id}/audit#run-${run.id}`}
            className="text-accent transition-opacity hover:opacity-80"
          >
            View audit trail →
          </Link>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-surface-2 p-4 text-sm">
        <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          Inputs used for this run
        </h2>
        <p className="leading-6 text-text">
          <span className="text-text-subtle">Thesis:</span>{" "}
          {run.thesisSnapshot}
        </p>
        {run.areasOfConcernSnapshot ? (
          <p className="mt-2 leading-6 text-text">
            <span className="text-text-subtle">Areas of concern:</span>{" "}
            {run.areasOfConcernSnapshot}
          </p>
        ) : null}
      </section>

      {memo.entityType === "fund" ? (
        <FundMemoView
          memo={synthesized as import("@/lib/agents/types").FundSynthesizedMemo}
        />
      ) : (
        <MemoView
          memo={synthesized as import("@/lib/agents/types").SynthesizedMemo}
        />
      )}
    </div>
  );
}
