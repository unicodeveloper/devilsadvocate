import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  getMemoById,
  listAuditEntriesForRun,
  listRunsForMemo,
} from "@/lib/memos";
import type { AuditEntry, MemoRun } from "@/lib/db/schema";
import { Badge, EmptyState } from "@/components/ui";
import type { ComponentProps } from "react";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

export const dynamic = "force-dynamic";

const AGENT_LABELS: Record<string, string> = {
  bull_advocate: "Bull Advocate",
  bear_advocate: "Bear Advocate",
  house_view_checker: "House View Checker",
  synthesizer: "Synthesizer",
};

const STATUS_TONE: Record<string, BadgeTone> = {
  completed: "success",
  failed: "danger",
  running: "warning",
};

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;
  const memo = await getMemoById(id);
  if (!memo) notFound();
  // Non-drafts are public-read; drafts are private to the owning FM.
  const isOwner = session?.user.id === memo.createdByUserId;
  if (!isOwner && memo.status === "draft") notFound();

  const runs = await listRunsForMemo(memo.id);
  const entriesByRun: Record<string, AuditEntry[]> = {};
  for (const run of runs) {
    entriesByRun[run.id] = await listAuditEntriesForRun(run.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/memos/${memo.id}`}
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
        <div className="mt-3 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          Reproducibility
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">
          Audit trail
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Every prompt, output, and Valyu response captured for{" "}
          <span className="font-mono text-xs text-text">{memo.stockTicker}</span>{" "}
          · {memo.stockName}.
        </p>
      </div>

      {runs.length === 0 ? (
        <EmptyState title="No runs yet" body="Run a stress-test to populate the audit trail." />
      ) : (
        <div className="flex flex-col gap-5">
          {runs.map((run) => (
            <RunSection
              key={run.id}
              run={run}
              entries={entriesByRun[run.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RunSection({ run, entries }: { run: MemoRun; entries: AuditEntry[] }) {
  const finishedAt = run.finishedAt ?? null;
  const durationMs = finishedAt
    ? finishedAt.getTime() - run.startedAt.getTime()
    : null;

  return (
    <section
      id={`run-${run.id}`}
      className="scroll-mt-20 overflow-hidden rounded-lg border border-border bg-surface"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-2 px-4 py-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-subtle">
              run
            </span>
            <span className="font-mono text-xs text-text">
              {run.id.slice(0, 8)}
            </span>
          </div>
          <div className="font-mono text-[11px] text-text-muted tabular-nums">
            Started {run.startedAt.toLocaleString()}
            {finishedAt ? ` · Finished ${finishedAt.toLocaleString()}` : null}
            {durationMs ? ` · ${(durationMs / 1000).toFixed(1)}s` : null}
          </div>
        </div>
        <Badge tone={STATUS_TONE[run.status] ?? "neutral"} dot>
          {run.status}
        </Badge>
      </header>

      {run.errorMessage ? (
        <div className="border-b border-border bg-danger-soft px-4 py-3 text-xs text-danger">
          {run.errorMessage}
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {entries.length === 0 ? (
          <li className="px-4 py-3 text-sm text-text-subtle">
            No agent traces.
          </li>
        ) : (
          entries.map((e) => <AuditEntryRow key={e.id} entry={e} />)
        )}
      </ul>
    </section>
  );
}

function AuditEntryRow({ entry }: { entry: AuditEntry }) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-text">
            {AGENT_LABELS[entry.agentName] ?? entry.agentName}
          </span>
          <Badge tone="neutral">{entry.model}</Badge>
        </div>
        <span className="font-mono text-[11px] text-text-subtle tabular-nums">
          {entry.durationMs ? `${(entry.durationMs / 1000).toFixed(2)}s` : "—"}
        </span>
      </div>

      <Disclosure label="Prompt">
        {prettyJson(entry.promptJson)}
      </Disclosure>
      <Disclosure label="Raw output">
        {prettyJson(entry.rawOutput)}
      </Disclosure>
      {entry.valyuResponsesJson ? (
        <Disclosure label="Valyu response">
          {prettyJson(entry.valyuResponsesJson)}
        </Disclosure>
      ) : null}
    </li>
  );
}

function Disclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="mt-2 group">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-[11px] text-text-muted transition-colors hover:text-text">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-subtle transition-transform group-open:rotate-90"
          aria-hidden="true"
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
        {label}
      </summary>
      <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-[11px] leading-5 text-text-muted">
        {children}
      </pre>
    </details>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
