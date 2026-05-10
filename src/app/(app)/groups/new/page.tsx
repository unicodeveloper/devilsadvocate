import Link from "next/link";
import { GatedForm } from "@/components/gated-form";
import { createGroupAction } from "../actions";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/groups"
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
        All groups
      </Link>
      <div className="mb-6 mt-3 border-b border-border pb-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          New group
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">
          Create issuer group
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Group a set of tickers under one label. The Exposure page will then
          let you query aggregate exposure across all funds for this group.
        </p>
      </div>
      <GatedForm
        action={createGroupAction}
        reason="Sign in to create an issuer group."
        className="flex flex-col gap-5"
      >
        <Field label="Group name" required>
          <input
            name="name"
            required
            placeholder="e.g. Adani Group"
            className={INPUT_CLS}
          />
        </Field>

        <Field
          label="Tickers"
          optional
          optionalNote="can edit later"
          helper="One per line, or comma/space-separated. Tickers are uppercased automatically."
        >
          <textarea
            name="tickers"
            rows={4}
            placeholder={
              "ADANIENT.NS\nADANIPORTS.NS\nADANIGREEN.NS\nADANIENSOL.NS\nADANIPOWER.NS"
            }
            className={`${INPUT_CLS} font-mono`}
          />
        </Field>

        <Field label="Notes" optional>
          <textarea
            name="notes"
            rows={2}
            placeholder="Why this group is being tracked, sources, etc."
            className={INPUT_CLS}
          />
        </Field>

        <div className="flex items-center justify-end border-t border-border pt-4">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Create group
          </button>
        </div>
      </GatedForm>
    </div>
  );
}

function Field({
  label,
  required = false,
  optional = false,
  optionalNote,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  optionalNote?: string;
  helper?: React.ReactNode;
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
          <span className="text-xs font-normal text-text-subtle">
            (optional{optionalNote ? ` · ${optionalNote}` : ""})
          </span>
        ) : null}
      </label>
      {children}
      {helper ? (
        <p className="text-[11px] leading-snug text-text-subtle">{helper}</p>
      ) : null}
    </div>
  );
}
