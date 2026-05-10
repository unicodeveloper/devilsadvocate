"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useSignIn } from "@/components/sign-in-provider";
import { Button, EmptyState } from "@/components/ui";
import { createFundMemoAction } from "./actions";

export type FundOption = {
  id: string;
  name: string;
  type: "mf" | "pms" | "aif";
  fundManager: string | null;
  holdingsCount: number;
};

const TYPE_LABEL = {
  mf: "Mutual Fund",
  pms: "PMS",
  aif: "AIF",
} as const;

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export function FundMemoForm({ funds }: { funds: FundOption[] }) {
  const [fundId, setFundId] = useState<string>(funds[0]?.id ?? "");
  const [thesis, setThesis] = useState("");
  const [areas, setAreas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isAuthed, requireAuth, user } = useSignIn();

  const eligible = funds.filter((f) => f.holdingsCount > 0);
  const selected = funds.find((f) => f.id === fundId);
  const thesisLen = thesis.trim().length;
  const thesisShort = thesisLen > 0 && thesisLen < 10;
  const canSubmit =
    !!selected && selected.holdingsCount > 0 && thesisLen >= 10 && !isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    if (!isAuthed) {
      requireAuth({
        reason: "Sign in as a Fund Manager to create a fund memo.",
      });
      return;
    }
    if (user?.role !== "fund_manager") {
      setError("Only Fund Managers can create memos.");
      return;
    }
    const fd = new FormData();
    fd.set("fundId", fundId);
    fd.set("thesis", thesis);
    if (areas.trim()) fd.set("areasOfConcern", areas);
    startTransition(async () => {
      try {
        await createFundMemoAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create memo");
      }
    });
  }

  if (funds.length === 0) {
    return (
      <EmptyState
        title="No funds yet"
        body="Add a fund and upload its holdings CSV before stress-testing a fund-level thesis."
        action={
          <Link
            href="/funds/new"
            className="text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            Add a fund →
          </Link>
        }
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field
        label="Fund"
        required
        helper={
          eligible.length > 0 && eligible.length < funds.length
            ? `${funds.length - eligible.length} fund(s) have no holdings yet.`
            : undefined
        }
      >
        <select
          value={fundId}
          onChange={(e) => setFundId(e.target.value)}
          className={INPUT_CLS}
        >
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {TYPE_LABEL[f.type]} · {f.name}
              {f.holdingsCount === 0
                ? " (no holdings)"
                : ` · ${f.holdingsCount} holdings`}
            </option>
          ))}
        </select>
        {selected && selected.holdingsCount === 0 ? (
          <p className="mt-1 rounded-md border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-warning-soft px-2.5 py-1.5 text-[11px] text-warning">
            This fund has no holdings — upload a CSV on the fund page before
            generating a stress-test.
          </p>
        ) : null}
      </Field>

      <Field
        label="Thesis"
        required
        helper="State your bullish (or bearish) view on the fund's strategy in 2-4 sentences."
      >
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="e.g. The Demo Auto Fund will outperform Nifty Auto by 250bps over 3 years on premium-mix shift, EV exposure via 2W names, and rural recovery."
          rows={4}
          className={INPUT_CLS}
        />
        {thesisShort ? (
          <FieldHint>
            {10 - thesisLen} more character
            {10 - thesisLen === 1 ? "" : "s"} needed before you can submit.
          </FieldHint>
        ) : null}
      </Field>

      <Field
        label="Areas of concern"
        optional
        helper="Steers the Bear Advocate to focus skepticism on these dimensions."
      >
        <textarea
          value={areas}
          onChange={(e) => setAreas(e.target.value)}
          placeholder="e.g. Top-3 concentration, EV transition risk on top holdings, manager turnover."
          rows={3}
          className={INPUT_CLS}
        />
      </Field>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft p-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Button type="submit" size="lg" disabled={!canSubmit} loading={isPending}>
          {isPending ? "Creating…" : "Create draft"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required = false,
  optional = false,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-baseline gap-1.5 text-sm font-medium text-text">
        <span>{label}</span>
        {required ? (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
        {optional ? (
          <span className="text-xs font-normal text-text-subtle">(optional)</span>
        ) : null}
      </label>
      {children}
      {helper ? (
        <p className="text-[11px] leading-snug text-text-subtle">{helper}</p>
      ) : null}
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] leading-snug text-warning">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
