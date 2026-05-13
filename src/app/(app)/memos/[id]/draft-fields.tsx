"use client";

import { useState, useTransition } from "react";
import { useSignIn } from "@/components/sign-in-provider";
import { Button } from "@/components/ui";
import { updateDraftAction } from "./actions";
import { SectionBadge } from "./section-badge";
import type { LoadedObjection } from "@/lib/reviews-shared";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm leading-6 text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export function DraftFields({
  memoId,
  initialThesis,
  initialAreasOfConcern,
  initialPrivatePeers,
  entityType,
  objections = [],
}: {
  memoId: string;
  initialThesis: string;
  initialAreasOfConcern: string | null;
  initialPrivatePeers: string | null;
  entityType: "stock" | "fund" | "private_company";
  objections?: LoadedObjection[];
}) {
  const [editing, setEditing] = useState(false);
  const [thesis, setThesis] = useState(initialThesis);
  const [areas, setAreas] = useState(initialAreasOfConcern ?? "");
  const [peers, setPeers] = useState(initialPrivatePeers ?? "");
  const [savedThesis, setSavedThesis] = useState(initialThesis);
  const [savedAreas, setSavedAreas] = useState(initialAreasOfConcern ?? "");
  const [savedPeers, setSavedPeers] = useState(initialPrivatePeers ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isAuthed, requireAuth, user } = useSignIn();

  function onSave() {
    setError(null);
    if (!isAuthed) {
      requireAuth({ reason: "Sign in as the memo's Fund Manager to edit." });
      return;
    }
    if (user?.role !== "fund_manager") {
      setError("Only the Fund Manager who owns this memo can edit it.");
      return;
    }
    const fd = new FormData();
    fd.set("memoId", memoId);
    fd.set("thesis", thesis);
    if (areas.trim()) fd.set("areasOfConcern", areas);
    if (peers.trim()) fd.set("privatePeers", peers);

    startTransition(async () => {
      try {
        await updateDraftAction(fd);
        setSavedThesis(thesis);
        setSavedAreas(areas);
        setSavedPeers(peers);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  function onCancel() {
    setThesis(savedThesis);
    setAreas(savedAreas);
    setPeers(savedPeers);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-4">
        <ReadOnly
          title="Thesis"
          body={savedThesis}
          badge={<SectionBadge section="thesis" objections={objections} />}
          actions={
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
            >
              <PencilIcon />
              Edit
            </button>
          }
        />
        {savedAreas ? (
          <ReadOnly
            title="Areas of concern"
            body={savedAreas}
            badge={
              <SectionBadge section="areas_of_concern" objections={objections} />
            }
          />
        ) : null}
        {entityType === "stock" && savedPeers ? (
          <ReadOnly
            title="Private competitors"
            body={savedPeers}
            badge={
              <SectionBadge section="private_peers" objections={objections} />
            }
          />
        ) : null}
        <p className="text-[11px] leading-snug text-text-subtle">
          Editing thesis or concerns and re-running produces a new run with the
          updated inputs. Past runs remain in history with the inputs they used
          at the time.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Thesis</FieldLabel>
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          rows={4}
          className={INPUT_CLS}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel optional>Areas of concern</FieldLabel>
        <textarea
          value={areas}
          onChange={(e) => setAreas(e.target.value)}
          rows={3}
          placeholder="e.g. EV transition risk, rural demand softness, raw-material costs"
          className={INPUT_CLS}
        />
      </div>

      {entityType === "stock" ? (
        <div className="flex flex-col gap-1.5">
          <FieldLabel optional optionalNote="comma-separated, up to 5">
            Private competitors
          </FieldLabel>
          <input
            value={peers}
            onChange={(e) => setPeers(e.target.value)}
            placeholder="e.g. Ola Electric, Ather Energy"
            className={INPUT_CLS}
          />
        </div>
      ) : null}

      {error ? (
        <p className="text-[11px] text-danger">{error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={isPending || thesis.trim().length < 10}
          loading={isPending}
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ReadOnly({
  title,
  body,
  actions,
  badge,
}: {
  title: string;
  body: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
            {title}
          </h2>
          {badge}
        </div>
        {actions}
      </div>
      <p className="rounded-lg border border-border bg-surface p-4 text-sm leading-6 text-text">
        {body}
      </p>
    </section>
  );
}

function FieldLabel({
  children,
  optional = false,
  optionalNote,
}: {
  children: React.ReactNode;
  optional?: boolean;
  optionalNote?: string;
}) {
  return (
    <span className="flex items-baseline gap-1.5 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
      {children}
      {optional ? (
        <span className="font-normal normal-case text-text-subtle">
          (optional{optionalNote ? ` · ${optionalNote}` : ""})
        </span>
      ) : null}
    </span>
  );
}

function PencilIcon() {
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
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
    </svg>
  );
}
