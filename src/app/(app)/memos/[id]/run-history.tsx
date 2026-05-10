import Link from "next/link";
import type { MemoRun } from "@/lib/db/schema";
import { Badge } from "@/components/ui";
import type { ComponentProps } from "react";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const STATUS_TONE: Record<string, BadgeTone> = {
  running: "warning",
  completed: "success",
  failed: "danger",
};

export function RunHistory({
  memoId,
  runs,
}: {
  memoId: string;
  runs: MemoRun[];
}) {
  if (runs.length === 0) return null;

  return (
    <details className="group rounded-lg border border-border bg-surface">
      <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-surface-2">
        <span className="flex items-center gap-2 font-medium text-text">
          <svg
            width="13"
            height="13"
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
          Run history
          <Badge tone="neutral">
            {runs.length} run{runs.length === 1 ? "" : "s"}
          </Badge>
        </span>
        <span className="text-[11px] text-text-subtle group-open:hidden">
          Click to expand
        </span>
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {runs.map((r) => {
          const durationMs = r.finishedAt
            ? r.finishedAt.getTime() - r.startedAt.getTime()
            : null;
          return (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-surface-2"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-text-subtle tabular-nums">
                    {r.id.slice(0, 8)}
                  </span>
                  <Badge tone={STATUS_TONE[r.status] ?? "neutral"} dot>
                    {r.status}
                  </Badge>
                  <span className="font-mono text-[11px] text-text-muted tabular-nums">
                    {r.startedAt.toLocaleString()}
                  </span>
                  {durationMs != null ? (
                    <span className="font-mono text-[11px] text-text-subtle tabular-nums">
                      · {(durationMs / 1000).toFixed(1)}s
                    </span>
                  ) : null}
                </div>
                {r.errorMessage ? (
                  <p className="text-[11px] text-danger">{r.errorMessage}</p>
                ) : (
                  <p className="line-clamp-1 text-[11px] text-text-muted">
                    Thesis: &ldquo;{r.thesisSnapshot}&rdquo;
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11px]">
                {r.status === "completed" ? (
                  <Link
                    href={`/memos/${memoId}/runs/${r.id}`}
                    className="text-text-muted transition-colors hover:text-text"
                  >
                    View
                  </Link>
                ) : null}
                <Link
                  href={`/memos/${memoId}/audit#run-${r.id}`}
                  className="text-text-muted transition-colors hover:text-text"
                >
                  Audit
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
