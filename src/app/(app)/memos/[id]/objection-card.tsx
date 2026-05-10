"use client";

import { useState, useTransition } from "react";
import {
  disputeObjectionAction,
  resolveObjectionAction,
  wontfixObjectionAction,
} from "./actions";
import type { LoadedObjection } from "@/lib/reviews-shared";
import { Badge } from "@/components/ui";
import type { ComponentProps } from "react";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const SEVERITY_META: Record<
  string,
  { tone: BadgeTone; accentVar: string; iconChar: string }
> = {
  BLOCKING: { tone: "danger", accentVar: "var(--danger)", iconChar: "⛔" },
  MAJOR: { tone: "warning", accentVar: "var(--warning)", iconChar: "▲" },
  MINOR: { tone: "info", accentVar: "var(--info)", iconChar: "·" },
  INFO: { tone: "neutral", accentVar: "var(--text-muted)", iconChar: "·" },
};

const STATUS_TONE: Record<string, { label: string; tone: BadgeTone }> = {
  open: { label: "Open", tone: "neutral" },
  resolved: { label: "Resolved", tone: "success" },
  disputed: { label: "Disputed", tone: "purple" },
  wontfix: { label: "Won't fix", tone: "neutral" },
};

const TYPE_LABELS: Record<string, string> = {
  house_view_violation: "House View",
  data_contradiction: "Data",
  unsupported_claim: "Unsupported",
  consensus_divergence: "Consensus",
  private_peer_threat: "Private peer",
  macro_risk: "Macro",
  thesis_incoherence: "Coherence",
  blind_spot: "Blind spot",
};

export function ObjectionCard({ objection }: { objection: LoadedObjection }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"closed" | "dispute" | "resolve" | "wontfix">("closed");
  const [body, setBody] = useState("");

  const isOpen = objection.status === "open";
  const sev = SEVERITY_META[objection.severity] ?? SEVERITY_META.INFO;
  const statusInfo = STATUS_TONE[objection.status] ?? STATUS_TONE.open;

  function submit(action: "resolve" | "dispute" | "wontfix") {
    setError(null);
    const fd = new FormData();
    fd.set("objectionId", objection.id);
    if (action === "dispute") {
      if (body.trim().length < 10) {
        setError("Add at least a sentence on why this objection doesn't hold.");
        return;
      }
      fd.set("body", body);
    } else if (body.trim()) {
      fd.set("note", body);
    }
    startTransition(async () => {
      try {
        if (action === "resolve") await resolveObjectionAction(fd);
        else if (action === "dispute") await disputeObjectionAction(fd);
        else await wontfixObjectionAction(fd);
        setMode("closed");
        setBody("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div
      id={`objection-${objection.id}`}
      style={{ "--card-accent": sev.accentVar } as React.CSSProperties}
      className="relative scroll-mt-24 overflow-hidden rounded-lg border border-border bg-surface text-sm transition-colors"
    >
      {/* Severity-tinted left rail */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-[var(--card-accent)]"
      />

      <div className="px-3.5 py-3 pl-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-text-subtle">
              <span style={{ color: sev.accentVar }}>{sev.iconChar}</span>
              <span style={{ color: sev.accentVar }}>{objection.severity}</span>
              <span aria-hidden="true">·</span>
              <span>{TYPE_LABELS[objection.type] ?? objection.type}</span>
            </div>
            <p className="font-medium leading-snug text-text">
              {objection.title}
            </p>
          </div>
          <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
        </div>

        <p className="mt-2 text-xs leading-5 text-text-muted">{objection.body}</p>

        {objection.evidence.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5 text-[11px] leading-snug text-text-muted">
            {objection.evidence.slice(0, 3).map((e, i) => (
              <li
                key={i}
                className="border-l-2 border-[var(--card-accent)] pl-2 opacity-90"
              >
                {e.excerpt ? <span className="italic">“{e.excerpt}”</span> : null}
                {e.source.url ? (
                  <a
                    href={e.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-accent underline-offset-4 hover:underline"
                  >
                    {e.source.title ?? "source"}
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {objection.recommendation ? (
          <p className="mt-3 text-[11px] italic text-text-subtle">
            → {objection.recommendation}
          </p>
        ) : null}

        {objection.threads.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-2.5 text-[11px] leading-snug text-text-muted">
            {objection.threads.map((t) => (
              <div key={t.id} className="flex gap-1.5">
                <span className="font-medium text-text">
                  {t.authorKind === "engine" ? "Mandate:" : "You:"}
                </span>
                <span>{t.body}</span>
              </div>
            ))}
          </div>
        ) : null}

        {isOpen ? (
          <div className="mt-3 flex flex-col gap-2">
            {mode === "closed" ? (
              <div className="flex flex-wrap gap-1.5">
                <ActionTrigger onClick={() => setMode("resolve")}>
                  Mark resolved
                </ActionTrigger>
                <ActionTrigger onClick={() => setMode("dispute")}>
                  Dispute
                </ActionTrigger>
                {objection.severity !== "BLOCKING" &&
                objection.severity !== "MAJOR" ? (
                  <ActionTrigger onClick={() => setMode("wontfix")}>
                    Won&apos;t fix
                  </ActionTrigger>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-2.5">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    mode === "dispute"
                      ? "Why doesn't this objection hold?"
                      : "Optional note (what did you change?)"
                  }
                  rows={2}
                  className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]"
                />
                {error ? (
                  <span className="text-[11px] text-danger">{error}</span>
                ) : null}
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("closed");
                      setBody("");
                      setError(null);
                    }}
                    className="rounded-md px-2.5 py-1 text-xs text-text-muted transition-colors hover:bg-surface-3 hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => submit(mode)}
                    disabled={isPending}
                    style={{
                      backgroundColor: sev.accentVar,
                    }}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending
                      ? "…"
                      : mode === "dispute"
                        ? "Submit dispute"
                        : mode === "resolve"
                          ? "Mark resolved"
                          : "Mark won't fix"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ActionTrigger({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-muted transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-text"
    >
      {children}
    </button>
  );
}
