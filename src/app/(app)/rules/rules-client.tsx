"use client";

import { useState, useTransition } from "react";
import { Badge, Button, EmptyState as EmptyStateUI } from "@/components/ui";
import {
  createCustomRuleAction,
  deleteCustomRuleAction,
  toggleRuleAction,
  updateCustomRuleAction,
} from "./actions";

export type RuleVm = {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  severity: "HARD" | "SOFT";
  source: "house_view" | "builtin" | "custom";
  scope: "stock" | "fund" | "both";
  evaluatorKind: "code" | "ai";
  enabled: boolean;
  prompt: string | null;
  updatedAt: string;
};

type EditingState = { mode: "create" } | { mode: "edit"; rule: RuleVm } | null;

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export function RulesClient({
  builtIn,
  custom,
}: {
  builtIn: RuleVm[];
  custom: RuleVm[];
}) {
  const [editing, setEditing] = useState<EditingState>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setEditing({ mode: "create" })}
          iconLeft={
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          }
        >
          Add custom rule
        </Button>
      </div>

      {editing ? (
        <RuleForm
          key={editing.mode === "edit" ? editing.rule.id : "create"}
          initial={editing.mode === "edit" ? editing.rule : null}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <Section
        title="Custom rules"
        subtitle="LLM-evaluated against the memo on every submit"
      >
        {custom.length === 0 ? (
          <EmptyStateUI
            title="No custom rules yet"
            body="Add a rule with a natural-language prompt and the Critic engine will evaluate every submitted memo against it."
            action={
              <button
                type="button"
                onClick={() => setEditing({ mode: "create" })}
                className="text-xs font-medium text-accent underline-offset-4 hover:underline"
              >
                Add your first →
              </button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {custom.map((r) => (
              <RuleRow
                key={r.id}
                rule={r}
                onEdit={() => setEditing({ mode: "edit", rule: r })}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Built-in rules"
        subtitle="Ship with Mandate. Disable any you don't want enforced."
      >
        <ul className="flex flex-col gap-2">
          {builtIn.map((r) => (
            <RuleRow key={r.id} rule={r} onEdit={null} />
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-text">
          {title}
        </h2>
        <p className="text-[11px] text-text-subtle">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function RuleRow({ rule, onEdit }: { rule: RuleVm; onEdit: (() => void) | null }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const fd = new FormData();
    fd.set("ruleId", rule.id);
    fd.set("enabled", String(!rule.enabled));
    startTransition(async () => {
      try {
        await toggleRuleAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Toggle failed");
      }
    });
  }

  function deleteRule() {
    if (!confirm(`Delete "${rule.displayName}"? This can't be undone.`)) return;
    setError(null);
    const fd = new FormData();
    fd.set("ruleId", rule.id);
    startTransition(async () => {
      try {
        await deleteCustomRuleAction(fd);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border p-3.5 transition-opacity ${
        rule.enabled
          ? "border-border bg-surface"
          : "border-border bg-surface opacity-55"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-text">{rule.displayName}</span>
            <SeverityChip severity={rule.severity} />
            <ScopeChip scope={rule.scope} />
            <SourceChip source={rule.source} kind={rule.evaluatorKind} />
          </div>
          <p className="text-xs leading-5 text-text-muted">{rule.description}</p>
          {rule.prompt ? (
            <details className="text-[11px] text-text-subtle">
              <summary className="cursor-pointer text-text-muted transition-colors hover:text-text">
                View prompt
              </summary>
              <pre className="mt-1.5 whitespace-pre-wrap rounded-md border border-border bg-surface-2 p-2.5 font-mono text-[11px] leading-5 text-text-muted">
                {rule.prompt}
              </pre>
            </details>
          ) : null}
          {error ? <span className="text-xs text-danger">{error}</span> : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Toggle enabled={rule.enabled} onToggle={toggle} disabled={isPending} />
          {onEdit || rule.source === "custom" ? (
            <div className="flex gap-3 text-xs">
              {onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="text-text-muted transition-colors hover:text-text"
                >
                  Edit
                </button>
              ) : null}
              {rule.source === "custom" ? (
                <button
                  type="button"
                  onClick={deleteRule}
                  className="text-danger transition-opacity hover:opacity-80"
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function Toggle({
  enabled,
  onToggle,
  disabled,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        enabled ? "bg-accent" : "bg-surface-3"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function SeverityChip({ severity }: { severity: "HARD" | "SOFT" }) {
  return <Badge tone={severity === "HARD" ? "danger" : "warning"}>{severity}</Badge>;
}

function ScopeChip({ scope }: { scope: "stock" | "fund" | "both" }) {
  const label = scope === "both" ? "stock + fund" : scope;
  return <Badge tone="neutral">{label}</Badge>;
}

function SourceChip({
  source,
  kind,
}: {
  source: "house_view" | "builtin" | "custom";
  kind: "code" | "ai";
}) {
  const label =
    source === "house_view"
      ? "House View"
      : source === "custom"
        ? `Custom · ${kind.toUpperCase()}`
        : `Built-in · ${kind.toUpperCase()}`;
  return (
    <Badge tone={source === "custom" ? "purple" : "info"}>{label}</Badge>
  );
}

function RuleForm({
  initial,
  onClose,
}: {
  initial: RuleVm | null;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [severity, setSeverity] = useState(initial?.severity ?? "SOFT");

  async function onSubmit(formData: FormData) {
    setError(null);
    if (initial) formData.set("ruleId", initial.id);
    startTransition(async () => {
      try {
        if (initial) await updateCustomRuleAction(formData);
        else await createCustomRuleAction(formData);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  return (
    <form
      action={onSubmit}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight text-text">
          {initial ? "Edit rule" : "Add custom rule"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-text-muted transition-colors hover:text-text"
        >
          Close
        </button>
      </div>

      <Field label="Name">
        <input
          name="displayName"
          required
          defaultValue={initial?.displayName ?? ""}
          maxLength={80}
          placeholder="e.g. No exposure to sanctioned issuers"
          className={INPUT_CLS}
        />
      </Field>

      <Field label="Description" hint="Shown to other team members in this list.">
        <textarea
          name="description"
          required
          defaultValue={initial?.description ?? ""}
          maxLength={500}
          rows={2}
          placeholder="A short note on what this rule enforces and why."
          className={INPUT_CLS}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Severity">
          <select
            name="severity"
            defaultValue={initial?.severity ?? "SOFT"}
            onChange={(e) => setSeverity(e.target.value as "HARD" | "SOFT")}
            className={INPUT_CLS}
          >
            <option value="SOFT">SOFT — flag, don&apos;t reject</option>
            <option value="HARD">HARD — reject if violated</option>
          </select>
        </Field>

        <Field label="Scope">
          <select
            name="scope"
            defaultValue={initial?.scope ?? "both"}
            className={INPUT_CLS}
          >
            <option value="both">Stock + Fund</option>
            <option value="stock">Stock only</option>
            <option value="fund">Fund only</option>
          </select>
        </Field>
      </div>

      {severity === "HARD" ? (
        <p className="rounded-md border border-[color-mix(in_oklab,var(--warning)_30%,transparent)] bg-warning-soft p-2.5 text-xs leading-snug text-warning">
          <span className="font-semibold">⚠ HARD rules reject memos outright.</span>{" "}
          AI-evaluated rules can hallucinate — start with SOFT and promote to HARD
          only after you trust its judgment.
        </p>
      ) : null}

      <Field
        label="Rule prompt"
        hint="Describe what to look for in the memo. The Critic engine sends this prompt + the memo to a fast LLM."
      >
        <textarea
          name="prompt"
          required
          defaultValue={initial?.prompt ?? ""}
          maxLength={2000}
          rows={5}
          placeholder="Examples:
• Flag the memo if it claims a price target without a quoted multiple basis (P/E, EV/EBITDA, etc.).
• Reject if the thesis recommends a name with active SEBI investigation."
          className={INPUT_CLS}
        />
      </Field>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending} loading={isPending}>
          {isPending ? "Saving…" : initial ? "Save changes" : "Create rule"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
        {label}
      </span>
      {children}
      {hint ? (
        <span className="text-[11px] leading-snug text-text-subtle">{hint}</span>
      ) : null}
    </label>
  );
}
