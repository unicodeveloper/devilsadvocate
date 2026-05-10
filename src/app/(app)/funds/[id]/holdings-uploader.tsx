"use client";

import { useState, useTransition } from "react";
import { useSignIn } from "@/components/sign-in-provider";
import { uploadHoldingsAction } from "../actions";

export function HoldingsUploader({ fundId }: { fundId: string }) {
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isAuthed, requireAuth } = useSignIn();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setWarnings(null);
    if (!isAuthed) {
      e.target.value = "";
      requireAuth({ reason: "Sign in to upload fund holdings." });
      return;
    }

    const fd = new FormData();
    fd.set("fundId", fundId);
    fd.set("holdingsCsv", file);

    startTransition(async () => {
      try {
        const w = await uploadHoldingsAction(fd);
        setWarnings(w);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
    e.target.value = "";
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3 text-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-muted">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-text">Replace holdings</p>
            <p className="text-[11px] leading-snug text-text-muted">
              Uploading a CSV replaces every row. Required headers:{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-text">ticker</code>,{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-text">name</code>,{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-text">weight_pct</code>.
            </p>
          </div>
        </div>
        <label
          className={`inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-accent px-3.5 text-xs font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover ${isPending ? "cursor-wait opacity-70" : ""}`}
        >
          {isPending ? (
            <>
              <Spinner />
              Uploading…
            </>
          ) : (
            "Choose CSV"
          )}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onChange}
            disabled={isPending}
          />
        </label>
      </div>
      {error ? (
        <p className="mt-3 text-xs text-danger">{error}</p>
      ) : null}
      {warnings && warnings.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1 rounded-md border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-warning-soft p-2.5 text-[11px] text-warning">
          {warnings.map((w, i) => (
            <li key={i}>· {w}</li>
          ))}
        </ul>
      ) : null}
      {warnings && warnings.length === 0 ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-success-soft px-2.5 py-1.5 text-[11px] text-success">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Holdings updated.
        </p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
