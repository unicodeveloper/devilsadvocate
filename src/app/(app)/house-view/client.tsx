"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Streamdown } from "streamdown";
import { useSignIn } from "@/components/sign-in-provider";
import { RichEditor } from "@/components/rich-editor";
import { Badge, Button } from "@/components/ui";
import { saveHouseViewAction } from "./actions";

type Version = {
  id: string;
  createdAt: string;
  authorName: string | null;
  authorEmail: string | null;
  content: string;
};

type Mode = "read" | "edit";

export function HouseViewClient({
  initialContent,
  lastUpdatedAt,
  latestAuthorName,
  versions,
  totalVersions,
  currentUserRole,
}: {
  initialContent: string;
  lastUpdatedAt: Date | null;
  latestAuthorName: string | null;
  versions: Version[];
  totalVersions: number;
  currentUserRole: "fund_manager" | "cio" | null;
}) {
  const [mode, setMode] = useState<Mode>("read");
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [savedAt, setSavedAt] = useState<Date | null>(lastUpdatedAt);
  const [savedAuthor, setSavedAuthor] = useState<string | null>(latestAuthorName);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isAuthed, requireAuth, user } = useSignIn();

  const isDirty = content !== savedContent;
  const stats = useMemo(() => computeStats(content), [content]);
  const savedStats = useMemo(() => computeStats(savedContent), [savedContent]);

  // beforeunload guard while unsaved changes are pending
  useEffect(() => {
    if (!isDirty || mode !== "edit") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, mode]);

  // Cmd/Ctrl+S to save while editing; Esc to exit edit mode
  useEffect(() => {
    if (mode !== "edit") return;
    const onKey = (e: KeyboardEvent) => {
      const isSave =
        (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s";
      if (isSave) {
        e.preventDefault();
        if (isDirty && !isPending) onSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        attemptCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isDirty, isPending]);

  // RichEditor handles its own autofocus when autoFocus prop is true.

  function startEdit() {
    setError(null);
    setFlash(null);
    if (!isAuthed) {
      requireAuth({
        reason: "Sign in to update the firm-wide House View.",
      });
      return;
    }
    setMode("edit");
  }

  function attemptCancel() {
    if (isDirty) {
      const ok = window.confirm(
        "Discard your unsaved changes to the House View?",
      );
      if (!ok) return;
    }
    setContent(savedContent);
    setError(null);
    setMode("read");
  }

  function onSave() {
    setError(null);
    if (!isAuthed) {
      requireAuth({
        reason: "Sign in to update the firm-wide House View.",
      });
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("content", content);
        await saveHouseViewAction(fd);
        setSavedContent(content);
        setSavedAt(new Date());
        setSavedAuthor(user?.name ?? user?.email ?? null);
        setFlash("Saved. New version recorded.");
        setMode("read");
        setTimeout(() => setFlash(null), 3500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  // Edit mode locks the page to viewport height and scrolls inside the
  // editor only. Read mode keeps natural page scroll.
  const isEdit = mode === "edit";
  const shellClass = isEdit
    ? "-my-8 flex h-[calc(100dvh-3.5rem)] flex-col gap-4 overflow-hidden py-4"
    : "flex flex-col gap-6 pb-12";

  return (
    <div className={shellClass}>
      <div className={isEdit ? "shrink-0" : ""}>
        <Header
          mode={mode}
          savedAt={savedAt}
          savedAuthor={savedAuthor}
          totalVersions={totalVersions}
          stats={isEdit ? stats : savedStats}
          isDirty={isDirty}
          isPending={isPending}
          canEdit={true}
          onEdit={startEdit}
          onCancel={attemptCancel}
          onSave={onSave}
          onToggleHistory={() => setHistoryOpen((v) => !v)}
          historyOpen={historyOpen}
          currentUserRole={currentUserRole}
        />
      </div>

      {flash ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-md border border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-success-soft px-3 py-2 text-sm text-success ${isEdit ? "shrink-0" : ""}`}
        >
          {flash}
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className={`rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2 text-sm text-danger ${isEdit ? "shrink-0" : ""}`}
        >
          {error}
        </div>
      ) : null}

      {isEdit ? (
        <Editor content={content} onChange={setContent} />
      ) : (
        <Reader content={savedContent} />
      )}

      {!isEdit ? (
        <VersionHistory
          open={historyOpen}
          versions={versions}
          currentSavedAt={savedAt}
        />
      ) : null}
    </div>
  );
}

function computeStats(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const sections = (content.match(/^#{1,2}\s+\S/gm) ?? []).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return { words, sections, minutes };
}

function formatRelative(date: Date): string {
  const ms = Date.now() - date.getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString();
}

/**
 * Renders a stable ISO date during SSR and the relative form after mount.
 * Avoids hydration mismatches caused by Date.now() / toLocaleString.
 */
function TimeAgo({
  date,
  fallback = "never",
}: {
  date: Date | null;
  fallback?: string;
}) {
  const [text, setText] = useState<string>(() =>
    date ? date.toISOString().slice(0, 10) : fallback,
  );
  const [absolute, setAbsolute] = useState<string>(() =>
    date ? date.toISOString() : "",
  );
  useEffect(() => {
    if (!date) return;
    const update = () => {
      setText(formatRelative(date));
      setAbsolute(date.toLocaleString());
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [date]);
  return <span title={absolute || undefined}>{text}</span>;
}

// ─── Header ────────────────────────────────────────────────────────────

function Header({
  mode,
  savedAt,
  savedAuthor,
  totalVersions,
  stats,
  isDirty,
  isPending,
  onEdit,
  onCancel,
  onSave,
  onToggleHistory,
  historyOpen,
  currentUserRole,
}: {
  mode: Mode;
  savedAt: Date | null;
  savedAuthor: string | null;
  totalVersions: number;
  stats: { words: number; sections: number; minutes: number };
  isDirty: boolean;
  isPending: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onToggleHistory: () => void;
  historyOpen: boolean;
  currentUserRole: "fund_manager" | "cio" | null;
}) {
  const versionLabel = totalVersions === 0 ? "Unsaved" : `v${totalVersions}`;
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            Firm-wide policy
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">
              House View
            </h1>
            <Badge tone={totalVersions === 0 ? "warning" : "neutral"}>
              {versionLabel}
            </Badge>
            {mode === "edit" && isDirty ? (
              <Badge tone="warning" dot aria-live="polite">
                Unsaved
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Source of truth for Mandate. Every memo run evaluates against the
            most recent saved version. Edits create immutable version snapshots.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {mode === "read" ? (
            <>
              <Button
                variant="outline"
                size="md"
                onClick={onToggleHistory}
                aria-expanded={historyOpen}
              >
                {historyOpen ? "Hide history" : `History (${totalVersions})`}
              </Button>
              <Button onClick={onEdit}>Edit</Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="md"
                onClick={onCancel}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={!isDirty || isPending}
                loading={isPending}
                title="Cmd/Ctrl+S"
              >
                {isPending ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <Stat label="Last saved">
          {savedAt ? (
            <TimeAgo date={savedAt} />
          ) : (
            <span className="text-warning">never (placeholder content)</span>
          )}
        </Stat>
        {savedAuthor ? <Stat label="Author">{savedAuthor}</Stat> : null}
        <Stat label="Sections">{stats.sections}</Stat>
        <Stat label="Words">{stats.words.toLocaleString()}</Stat>
        <Stat label="Reading">~{stats.minutes} min</Stat>
        {currentUserRole ? (
          <Stat label="You">
            <span className="capitalize">
              {currentUserRole.replace("_", " ")}
            </span>
          </Stat>
        ) : (
          <Stat label="You">read-only</Stat>
        )}
      </dl>
    </header>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="font-medium uppercase tracking-wider text-[10px] text-text-subtle">
        {label}
      </dt>
      <dd className="text-text-muted tabular-nums">{children}</dd>
    </div>
  );
}

// ─── Reader ────────────────────────────────────────────────────────────

function Reader({ content }: { content: string }) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <div
        className="
          prose prose-zinc dark:prose-invert max-w-none
          prose-headings:tracking-tight prose-headings:text-text
          prose-h1:text-3xl prose-h1:font-semibold prose-h1:mt-0
          prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-3
          prose-h3:text-[11px] prose-h3:font-semibold prose-h3:uppercase prose-h3:tracking-wider prose-h3:text-text-subtle
          prose-p:leading-7 prose-p:text-text
          prose-li:leading-7 prose-li:text-text
          prose-strong:text-text
          prose-blockquote:border-l-2 prose-blockquote:border-accent prose-blockquote:bg-surface prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:not-italic prose-blockquote:text-text-muted
          prose-code:rounded prose-code:bg-surface-2 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:text-text prose-code:before:content-none prose-code:after:content-none
          prose-a:text-accent prose-a:no-underline hover:prose-a:underline
        "
      >
        <Streamdown>{content}</Streamdown>
      </div>
    </article>
  );
}

// ─── Editor (single-pane WYSIWYG, fills viewport) ──────────────────────

function Editor({
  content,
  onChange,
}: {
  content: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <p className="shrink-0 text-right text-[11px] text-text-subtle">
        <Kbd>⌘ / Ctrl</Kbd>+<Kbd>S</Kbd> to save · <Kbd>Esc</Kbd> to exit
      </p>
      <RichEditor
        value={content}
        onChange={onChange}
        autoFocus
        placeholder="Start writing the firm's House View…"
        className="min-h-0 flex-1"
      />
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 rounded border border-border bg-surface-2 px-1 py-0.5 font-mono text-[10px] text-text-muted">
      {children}
    </kbd>
  );
}

// ─── Version history ───────────────────────────────────────────────────

function VersionHistory({
  open,
  versions,
  currentSavedAt,
}: {
  open: boolean;
  versions: Version[];
  currentSavedAt: Date | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!open) return null;
  if (versions.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-subtle">
        No saved versions yet. Your next save will record the first version.
      </section>
    );
  }

  return (
    <section
      aria-labelledby="version-history-heading"
      className="rounded-lg border border-border bg-surface"
    >
      <header className="border-b border-border px-4 py-3">
        <h2
          id="version-history-heading"
          className="text-[11px] font-medium uppercase tracking-wider text-text-subtle"
        >
          Version history ({versions.length}
          {versions.length === 25 ? "+" : ""})
        </h2>
        <p className="mt-0.5 text-[11px] text-text-subtle">
          Snapshots of every save. Click a row to view that version&apos;s content.
        </p>
      </header>
      <ul className="divide-y divide-border">
        {versions.map((v, idx) => {
          const isLatest =
            idx === 0 &&
            currentSavedAt &&
            new Date(v.createdAt).getTime() === currentSavedAt.getTime();
          const isExpanded = expandedId === v.id;
          const created = new Date(v.createdAt);
          const author = v.authorName ?? v.authorEmail ?? "Unknown";
          return (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : v.id)}
                aria-expanded={isExpanded}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-surface-2"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-text-subtle tabular-nums">
                      v{versions.length - idx}
                    </span>
                    <span className="font-medium text-text">{author}</span>
                    {isLatest ? (
                      <Badge tone="success">current</Badge>
                    ) : null}
                  </div>
                  <span className="text-[11px] text-text-subtle tabular-nums">
                    <TimeAgo date={created} /> ·{" "}
                    <span suppressHydrationWarning className="font-mono">
                      {created.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </span>
                </div>
                <span
                  aria-hidden="true"
                  className={`text-text-subtle transition-transform ${isExpanded ? "rotate-90" : ""}`}
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
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </span>
              </button>
              {isExpanded ? (
                <div className="border-t border-border bg-bg px-4 py-4">
                  <div className="prose prose-sm prose-zinc dark:prose-invert max-h-96 max-w-none overflow-auto rounded-md border border-border bg-surface p-4 prose-p:text-text prose-li:text-text prose-headings:text-text">
                    <Streamdown>{v.content}</Streamdown>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
