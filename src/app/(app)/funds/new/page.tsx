import Link from "next/link";
import { GatedForm } from "@/components/gated-form";
import { createFundAction } from "../actions";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export default function NewFundPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/funds"
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
        All funds
      </Link>
      <div className="mb-6 mt-3 border-b border-border pb-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
          New fund
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-text">
          Add fund
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Holdings CSV is optional — you can upload it later from the fund page.
        </p>
      </div>
      <GatedForm
        action={createFundAction}
        reason="Sign in to add a fund."
        className="flex flex-col gap-5"
      >
        <Field label="Fund name" required>
          <input
            name="name"
            required
            placeholder="e.g. Parag Parikh Flexi Cap Fund"
            className={INPUT_CLS}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <select
              name="type"
              required
              className={INPUT_CLS}
              defaultValue="mf"
            >
              <option value="mf">Mutual Fund</option>
              <option value="pms">PMS</option>
              <option value="aif">AIF</option>
            </select>
          </Field>
          <Field label="Scheme code" optional>
            <input
              name="schemeCode"
              placeholder="e.g. 122639"
              className={INPUT_CLS}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fund manager" optional>
            <input
              name="fundManager"
              placeholder="e.g. Rajeev Thakkar"
              className={INPUT_CLS}
            />
          </Field>
          <Field label="Currency" required>
            <select
              name="currency"
              required
              defaultValue="USD"
              className={INPUT_CLS}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="INR">INR — Indian Rupee</option>
              <option value="JPY">JPY — Japanese Yen</option>
            </select>
          </Field>
        </div>

        <Field
          label="AUM (in fund currency)"
          optional
          helper="Raw integer value in the currency selected above. Aggregations are displayed in USD using the latest FX snapshot."
        >
          <input
            name="aumNative"
            type="number"
            min={0}
            step={1}
            placeholder="e.g. 70000000000"
            className={INPUT_CLS}
          />
        </Field>

        <Field label="Notes" optional>
          <textarea
            name="notes"
            rows={2}
            placeholder="Strategy, mandate, rationale for tracking…"
            className={INPUT_CLS}
          />
        </Field>

        <Field
          label="Holdings CSV"
          optional
          optionalNote="can upload later"
          helper={
            <>
              Required headers: <code className="rounded bg-surface-2 px-1 py-0.5 text-text">ticker</code>, <code className="rounded bg-surface-2 px-1 py-0.5 text-text">name</code>,{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-text">weight_pct</code>. Optional:{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-text">sector</code>,{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-text">value_native</code>,{" "}
              <code className="rounded bg-surface-2 px-1 py-0.5 text-text">as_of_date</code>.
            </>
          }
        >
          <input
            name="holdingsCsv"
            type="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-text-muted file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-fg hover:file:bg-accent-hover"
          />
        </Field>

        <div className="flex items-center justify-end border-t border-border pt-4">
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg shadow-sm transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Add fund
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
