"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RunEvent } from "@/lib/agents/orchestrator";
import type {
  FundSynthesizedMemo,
  PrivateCompanySynthesizedMemo,
  SynthesizedMemo,
} from "@/lib/agents/types";
import { MemoView } from "./memo-view";
import { FundMemoView } from "./fund-memo-view";
import { PrivateCompanyMemoView } from "./private-company-memo-view";
import { Button } from "./ui";
import { cn } from "./ui/cn";

type AgentName =
  | "bull_advocate"
  | "bear_advocate"
  | "house_view_checker"
  | "synthesizer";

type AgentState = "idle" | "running" | "completed" | "failed";

const AGENT_LABELS: Record<AgentName, string> = {
  bull_advocate: "Bull Advocate",
  bear_advocate: "Bear Advocate",
  house_view_checker: "House View Checker",
  synthesizer: "Synthesizer",
};

const AGENT_DESCRIPTIONS: Record<AgentName, string> = {
  bull_advocate: "Strengthens the bullish case with sourced data.",
  bear_advocate: "Hunts contradictions via Valyu DeepResearch.",
  house_view_checker: "Evaluates thesis against firm-wide rules.",
  synthesizer: "Combines all findings into the final memo.",
};

const AGENT_ORDER: AgentName[] = [
  "bull_advocate",
  "bear_advocate",
  "house_view_checker",
  "synthesizer",
];

export function RunPanel({
  memoId,
  entityType,
  initialMemo,
}: {
  memoId: string;
  entityType: "stock" | "fund" | "private_company";
  initialMemo:
    | SynthesizedMemo
    | FundSynthesizedMemo
    | PrivateCompanySynthesizedMemo
    | null;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [agentStates, setAgentStates] = useState<
    Record<AgentName, { state: AgentState; durationMs?: number; error?: string }>
  >({
    bull_advocate: { state: "idle" },
    bear_advocate: { state: "idle" },
    house_view_checker: { state: "idle" },
    synthesizer: { state: "idle" },
  });
  const [memo, setMemo] = useState<
    | SynthesizedMemo
    | FundSynthesizedMemo
    | PrivateCompanySynthesizedMemo
    | null
  >(initialMemo);
  const [runError, setRunError] = useState<string | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const router = useRouter();

  const onPickFiles = useCallback((picked: FileList | File[]) => {
    const arr = Array.from(picked).filter(
      (f) =>
        f.type === "application/pdf" ||
        f.name.toLowerCase().endsWith(".pdf") ||
        f.type === "text/markdown" ||
        f.name.toLowerCase().endsWith(".md") ||
        f.type === "text/plain",
    );
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [
        ...prev,
        ...arr.filter((f) => !seen.has(`${f.name}-${f.size}`)),
      ];
    });
  }, []);

  const removeFile = (name: string, size: number) => {
    setFiles((prev) => prev.filter((f) => !(f.name === name && f.size === size)));
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dt = e.dataTransfer;
      if (dt?.files?.length) onPickFiles(dt.files);
    },
    [onPickFiles],
  );

  async function startRun() {
    setRunning(true);
    setRunError(null);
    setMemo(null);
    setAgentStates({
      bull_advocate: { state: "idle" },
      bear_advocate: { state: "idle" },
      house_view_checker: { state: "idle" },
      synthesizer: { state: "idle" },
    });

    const fd = new FormData();
    for (const f of files) fd.append("files", f);

    let res: Response;
    try {
      res = await fetch(`/api/memos/${memoId}/run`, {
        method: "POST",
        body: fd,
      });
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Network error");
      setRunning(false);
      return;
    }

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => "");
      setRunError(txt || `Run failed (${res.status})`);
      setRunning(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let event: RunEvent;
        try {
          event = JSON.parse(line) as RunEvent;
        } catch {
          continue;
        }
        applyEvent(event);
      }
    }

    if (buffer.trim()) {
      try {
        applyEvent(JSON.parse(buffer) as RunEvent);
      } catch {
        // ignore trailing non-JSON
      }
    }

    setRunning(false);
  }

  function applyEvent(event: RunEvent) {
    switch (event.type) {
      case "agent_started":
        setAgentStates((s) => ({
          ...s,
          [event.agent]: { state: "running" },
        }));
        break;
      case "agent_completed":
        setAgentStates((s) => ({
          ...s,
          [event.agent]: {
            state: "completed",
            durationMs: event.durationMs,
          },
        }));
        break;
      case "agent_failed":
        setAgentStates((s) => ({
          ...s,
          [event.agent]: { state: "failed", error: event.error },
        }));
        break;
      case "synthesis_completed":
        setMemo(event.memo);
        router.refresh();
        break;
      case "run_failed":
        setRunError(event.error);
        break;
      default:
        break;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Dropzone */}
      <div
        ref={dragRef}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-7 text-center transition-colors",
          isDragging
            ? "border-accent bg-accent-soft"
            : "border-border bg-surface hover:border-border-strong",
        )}
      >
        <UploadIcon className="text-text-subtle transition-colors group-hover:text-text-muted" />
        <p className="text-sm text-text">
          {entityType === "private_company"
            ? "Drop Pitch Decks, IC memos, or any supporting PDFs."
            : "Drop broker reports, IC memos, or any supporting PDFs."}
        </p>
        <p className="text-[11px] text-text-subtle">
          Files stay in memory for this run only — never persisted.
        </p>
        <label className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text">
          <span aria-hidden="true">+</span>
          <span>Or pick files</span>
          <input
            type="file"
            multiple
            accept=".pdf,.md,.txt"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {files.length > 0 ? (
          <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
            {files.map((f) => (
              <li
                key={`${f.name}-${f.size}`}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-[11px]"
              >
                <FileIcon />
                <span className="max-w-[14rem] truncate text-text">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(f.name, f.size)}
                  className="text-text-subtle transition-colors hover:text-danger"
                  aria-label={`Remove ${f.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* CTA row */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          {running ? (
            <>
              <PulseDot />
              <span>Running multi-agent stress-test…</span>
            </>
          ) : memo ? (
            <span>Latest run complete. Re-run to refresh.</span>
          ) : (
            <span className="text-text-subtle">Ready to run.</span>
          )}
        </div>
        <Button
          onClick={startRun}
          disabled={running}
          loading={running}
          size="lg"
        >
          {running
            ? "Running…"
            : memo
              ? "Re-run stress-test"
              : "Generate stress-test"}
        </Button>
      </div>

      {/* Agent state grid */}
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {AGENT_ORDER.map((agent) => {
          const s = agentStates[agent];
          return (
            <li
              key={agent}
              className={cn(
                "relative overflow-hidden rounded-lg border bg-surface p-3 transition-colors",
                s.state === "running" && "border-warning",
                s.state === "completed" && "border-success/40",
                s.state === "failed" && "border-danger/60",
                s.state === "idle" && "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">
                  {AGENT_LABELS[agent]}
                </span>
                <AgentStatusDot state={s.state} />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-text-muted">
                {AGENT_DESCRIPTIONS[agent]}
              </p>
              {s.state === "running" ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-px overflow-hidden"
                >
                  <div className="agent-progress h-full w-full bg-warning" />
                </div>
              ) : null}
              {s.state === "completed" && s.durationMs ? (
                <p className="mt-1.5 font-mono text-[11px] text-success tabular-nums">
                  ✓ {(s.durationMs / 1000).toFixed(1)}s
                </p>
              ) : null}
              {s.state === "failed" && s.error ? (
                <p className="mt-1.5 line-clamp-2 text-[11px] text-danger">
                  {s.error}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {runError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft p-3 text-sm text-danger"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{runError}</span>
        </div>
      ) : null}

      {memo ? (
        <div className="border-t border-border pt-5">
          {entityType === "fund" ? (
            <FundMemoView memo={memo as FundSynthesizedMemo} />
          ) : entityType === "private_company" ? (
            <PrivateCompanyMemoView
              memo={memo as PrivateCompanySynthesizedMemo}
            />
          ) : (
            <MemoView memo={memo as SynthesizedMemo} />
          )}
        </div>
      ) : null}

      <style jsx>{`
        @keyframes agent-progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
        :global(.agent-progress) {
          animation: agent-progress 1.6s linear infinite;
        }
      `}</style>
    </div>
  );
}

function AgentStatusDot({ state }: { state: AgentState }) {
  if (state === "running") {
    return (
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
      </span>
    );
  }
  const cls: Record<AgentState, string> = {
    idle: "bg-text-subtle/40",
    running: "",
    completed: "bg-success shadow-[0_0_8px_var(--success)]",
    failed: "bg-danger shadow-[0_0_8px_var(--danger)]",
  };
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full transition-all",
        cls[state],
      )}
    />
  );
}

function PulseDot() {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
    </span>
  );
}

function UploadIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-subtle"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
