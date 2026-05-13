"use client";

import { useState, useTransition } from "react";
import { useSignIn } from "@/components/sign-in-provider";
import { Button } from "@/components/ui";
import { createPrivateCompanyMemoAction } from "./actions";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

const STAGES: Array<{
  value: "seed" | "series_a" | "series_b";
  label: string;
}> = [
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
];

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function parseFoundersInput(raw: string): string[] {
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PrivateCompanyMemoForm() {
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [founders, setFounders] = useState("");
  const [stage, setStage] = useState<"seed" | "series_a" | "series_b">("seed");
  const [sector, setSector] = useState("");
  const [geo, setGeo] = useState("");
  const [checkSize, setCheckSize] = useState("");
  const [postMoney, setPostMoney] = useState("");
  const [thesis, setThesis] = useState("");
  const [areas, setAreas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isAuthed, requireAuth, user } = useSignIn();

  const founderCount = parseFoundersInput(founders).length;
  const thesisLen = thesis.trim().length;
  const thesisShort = thesisLen > 0 && thesisLen < 10;
  const urlOk = companyUrl.trim().length > 0 && isValidUrl(companyUrl.trim());
  const urlBad = companyUrl.trim().length > 0 && !urlOk;

  const canSubmit =
    companyName.trim().length > 0 &&
    urlOk &&
    founderCount > 0 &&
    thesisLen >= 10 &&
    !isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    if (!isAuthed) {
      requireAuth({
        reason: "Sign in as a Fund Manager to create a private-company memo.",
      });
      return;
    }
    if (user?.role !== "fund_manager") {
      setError("Only Fund Managers can create memos.");
      return;
    }
    const fd = new FormData();
    fd.set("privateCompanyName", companyName.trim());
    fd.set("privateCompanyUrl", companyUrl.trim());
    fd.set(
      "privateCompanyFounders",
      JSON.stringify(parseFoundersInput(founders)),
    );
    fd.set("privateCompanyRoundStage", stage);
    if (sector.trim()) fd.set("privateCompanySector", sector.trim());
    if (geo.trim()) fd.set("privateCompanyGeo", geo.trim());
    if (checkSize.trim()) fd.set("privateCompanyCheckSizeUsd", checkSize);
    if (postMoney.trim()) fd.set("privateCompanyPostMoneyUsd", postMoney);
    fd.set("thesis", thesis);
    if (areas.trim()) fd.set("areasOfConcern", areas);

    startTransition(async () => {
      try {
        await createPrivateCompanyMemoAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create memo");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field
        label="Company name"
        required
        helper="The legal or trade name of the company you're considering."
      >
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="e.g. Modular Health"
          className={INPUT_CLS}
        />
      </Field>

      <Field
        label="Website URL"
        required
        helper="Used by the Devil's Advocate to anchor the public-data dossier (company profile, press, hiring signals)."
      >
        <input
          value={companyUrl}
          onChange={(e) => setCompanyUrl(e.target.value)}
          placeholder="https://modularhealth.com"
          className={INPUT_CLS}
        />
        {urlBad ? (
          <FieldHint>Must be a valid http(s) URL.</FieldHint>
        ) : null}
      </Field>

      <Field
        label="Founders"
        required
        helper="Comma-separated. The Bear Advocate researches each founder's public footprint (prior cos, operator roles, flags)."
      >
        <input
          value={founders}
          onChange={(e) => setFounders(e.target.value)}
          placeholder="e.g. Jane Patel, Anand Rao"
          className={INPUT_CLS}
        />
        {founders.trim().length > 0 ? (
          <p className="text-[11px] text-text-subtle">
            {founderCount} founder{founderCount === 1 ? "" : "s"} parsed
          </p>
        ) : null}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Round stage" required>
          <select
            value={stage}
            onChange={(e) =>
              setStage(
                e.target.value as "seed" | "series_a" | "series_b",
              )
            }
            className={INPUT_CLS}
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Sector"
          optional
          helper="Required for House View sector allow/blocklist enforcement."
        >
          <input
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            placeholder="e.g. Fintech, Healthcare, B2B SaaS"
            className={INPUT_CLS}
          />
        </Field>

        <Field
          label="Geography"
          optional
          helper="HQ country/region. Used by House View geo allowlist."
        >
          <input
            value={geo}
            onChange={(e) => setGeo(e.target.value)}
            placeholder="e.g. US, UK, India"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="Check size (USD)" optional>
          <input
            type="number"
            min={0}
            step={1000}
            value={checkSize}
            onChange={(e) => setCheckSize(e.target.value)}
            placeholder="e.g. 50000"
            className={INPUT_CLS}
          />
        </Field>

        <Field
          label="Post-money valuation (USD)"
          optional
          helper="Enables the Bear Advocate's terms-risk pass."
        >
          <input
            type="number"
            min={0}
            step={100000}
            value={postMoney}
            onChange={(e) => setPostMoney(e.target.value)}
            placeholder="e.g. 5000000"
            className={INPUT_CLS}
          />
        </Field>
      </div>

      <Field
        label="Thesis"
        required
        helper="Why this deal — 2-4 sentences. Devil's Advocate will stress-test it against public data + your mandate."
      >
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="e.g. Strong technical founders in a fragmented $5B+ market with a thin-wedge GTM via SMB integrators. Stage-appropriate ARR + retention; pricing power emerges at $1M ARR."
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
        helper="Steers the Bear Advocate to concentrate skepticism here."
      >
        <textarea
          value={areas}
          onChange={(e) => setAreas(e.target.value)}
          placeholder="e.g. Single-channel distribution dependency, weak retention signals, founder-market fit at scale."
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
