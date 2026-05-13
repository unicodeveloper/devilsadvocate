"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import { savePrivateMandateAction } from "./actions";
import type { PrivateMandateFields } from "@/lib/house-view";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

type ListField =
  | "stageAllowlist"
  | "sectorAllowlist"
  | "sectorBlocklist"
  | "geoAllowlist";

const STAGE_OPTIONS: Array<{
  value: "seed" | "series_a" | "series_b";
  label: string;
}> = [
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
];

function joinList(arr: string[] | null): string {
  return arr ? arr.join(", ") : "";
}

function parseList(raw: string): string[] {
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PrivateMandatePanel({
  initial,
  canEdit,
}: {
  initial: PrivateMandateFields;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [checkMin, setCheckMin] = useState(
    initial.checkSizeMinUsd?.toString() ?? "",
  );
  const [checkMax, setCheckMax] = useState(
    initial.checkSizeMaxUsd?.toString() ?? "",
  );
  const [stages, setStages] = useState<Set<"seed" | "series_a" | "series_b">>(
    new Set(
      initial.stageAllowlist as Array<"seed" | "series_a" | "series_b">,
    ) ?? new Set(),
  );
  const [sectorAllow, setSectorAllow] = useState(
    joinList(initial.sectorAllowlist),
  );
  const [sectorBlock, setSectorBlock] = useState(
    joinList(initial.sectorBlocklist),
  );
  const [geoAllow, setGeoAllow] = useState(joinList(initial.geoAllowlist));
  const [saved, setSaved] = useState<PrivateMandateFields>(initial);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleStage(s: "seed" | "series_a" | "series_b") {
    setStages((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function onSave() {
    setError(null);
    const payload: PrivateMandateFields = {
      checkSizeMinUsd: checkMin.trim() ? Number(checkMin) : null,
      checkSizeMaxUsd: checkMax.trim() ? Number(checkMax) : null,
      stageAllowlist: stages.size > 0 ? Array.from(stages) : null,
      sectorAllowlist:
        sectorAllow.trim().length > 0 ? parseList(sectorAllow) : null,
      sectorBlocklist:
        sectorBlock.trim().length > 0 ? parseList(sectorBlock) : null,
      geoAllowlist: geoAllow.trim().length > 0 ? parseList(geoAllow) : null,
    };
    startTransition(async () => {
      try {
        await savePrivateMandateAction(payload);
        setSaved(payload);
        setFlash("Private mandate saved. New version recorded.");
        setTimeout(() => setFlash(null), 3500);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  const summary = summarizeMandate(saved);
  const dirty = isDirty(saved, {
    checkSizeMinUsd: checkMin.trim() ? Number(checkMin) : null,
    checkSizeMaxUsd: checkMax.trim() ? Number(checkMax) : null,
    stageAllowlist: stages.size > 0 ? Array.from(stages) : null,
    sectorAllowlist:
      sectorAllow.trim().length > 0 ? parseList(sectorAllow) : null,
    sectorBlocklist:
      sectorBlock.trim().length > 0 ? parseList(sectorBlock) : null,
    geoAllowlist: geoAllow.trim().length > 0 ? parseList(geoAllow) : null,
  });

  return (
    <section className="rounded-lg border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2"
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
              Private-company mandate
            </span>
            <Badge tone={summary.hasAny ? "accent" : "neutral"}>
              {summary.hasAny ? "Configured" : "Not set"}
            </Badge>
          </div>
          <p className="text-[11px] leading-snug text-text-muted">
            Mechanical rules the Devil&apos;s Advocate enforces on private-co
            deal memos (check size, stage, sector, geo). Violations are
            facts, not judgment calls.
          </p>
          {summary.line ? (
            <p className="mt-1 font-mono text-[11px] text-text">{summary.line}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className={`text-text-subtle transition-transform ${open ? "rotate-90" : ""}`}
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

      {open ? (
        <div className="flex flex-col gap-5 border-t border-border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Min check (USD)"
              helper="Leave blank for no lower bound."
            >
              <input
                type="number"
                min={0}
                step={1000}
                value={checkMin}
                onChange={(e) => setCheckMin(e.target.value)}
                placeholder="e.g. 25000"
                className={INPUT_CLS}
                disabled={!canEdit}
              />
            </Field>
            <Field
              label="Max check (USD)"
              helper="Hard ceiling. The Synthesizer treats exceeding this as a kill."
            >
              <input
                type="number"
                min={0}
                step={1000}
                value={checkMax}
                onChange={(e) => setCheckMax(e.target.value)}
                placeholder="e.g. 100000"
                className={INPUT_CLS}
                disabled={!canEdit}
              />
            </Field>
          </div>

          <Field
            label="Allowed stages"
            helper="If none selected, no stage restriction is enforced."
          >
            <div className="flex flex-wrap gap-2">
              {STAGE_OPTIONS.map((s) => {
                const active = stages.has(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => canEdit && toggleStage(s.value)}
                    disabled={!canEdit}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-border bg-surface text-text-muted hover:border-border-strong"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <ListField
            label="Sector allowlist"
            helper="Comma-separated. If set, deals outside these sectors get flagged. Leave blank for no allowlist."
            value={sectorAllow}
            onChange={setSectorAllow}
            disabled={!canEdit}
            placeholder="Fintech, B2B SaaS, AI infrastructure"
          />
          <ListField
            label="Sector blocklist"
            helper="Deals in these sectors are always flagged regardless of allowlist."
            value={sectorBlock}
            onChange={setSectorBlock}
            disabled={!canEdit}
            placeholder="Gambling, Crypto, Defense"
          />
          <ListField
            label="Geography allowlist"
            helper="Country / region codes the mandate covers."
            value={geoAllow}
            onChange={setGeoAllow}
            disabled={!canEdit}
            placeholder="US, UK, EU"
          />

          {error ? (
            <div
              role="alert"
              className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft p-3 text-sm text-danger"
            >
              {error}
            </div>
          ) : null}
          {flash ? (
            <div
              role="status"
              className="rounded-md border border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-success-soft p-3 text-sm text-success"
            >
              {flash}
            </div>
          ) : null}

          {canEdit ? (
            <div className="flex items-center justify-end gap-3 border-t border-border pt-3">
              <Button
                onClick={onSave}
                disabled={!dirty || isPending}
                loading={isPending}
              >
                {isPending ? "Saving…" : "Save mandate"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-text">{label}</label>
      {children}
      {helper ? (
        <p className="text-[11px] leading-snug text-text-subtle">{helper}</p>
      ) : null}
    </div>
  );
}

function ListField({
  label,
  helper,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Field label={label} helper={helper}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={INPUT_CLS}
        disabled={disabled}
      />
    </Field>
  );
}

function summarizeMandate(m: PrivateMandateFields): {
  hasAny: boolean;
  line: string;
} {
  const parts: string[] = [];
  if (m.checkSizeMinUsd !== null || m.checkSizeMaxUsd !== null) {
    const min =
      m.checkSizeMinUsd !== null ? `$${m.checkSizeMinUsd.toLocaleString()}` : "–";
    const max =
      m.checkSizeMaxUsd !== null ? `$${m.checkSizeMaxUsd.toLocaleString()}` : "–";
    parts.push(`Check ${min}–${max}`);
  }
  if (m.stageAllowlist && m.stageAllowlist.length > 0) {
    parts.push(`Stages ${m.stageAllowlist.join("/")}`);
  }
  if (m.sectorAllowlist && m.sectorAllowlist.length > 0) {
    parts.push(`Allow ${m.sectorAllowlist.length} sectors`);
  }
  if (m.sectorBlocklist && m.sectorBlocklist.length > 0) {
    parts.push(`Block ${m.sectorBlocklist.length} sectors`);
  }
  if (m.geoAllowlist && m.geoAllowlist.length > 0) {
    parts.push(`Geo ${m.geoAllowlist.join("/")}`);
  }
  return { hasAny: parts.length > 0, line: parts.join(" · ") };
}

function isDirty(
  saved: PrivateMandateFields,
  current: PrivateMandateFields,
): boolean {
  return (
    saved.checkSizeMinUsd !== current.checkSizeMinUsd ||
    saved.checkSizeMaxUsd !== current.checkSizeMaxUsd ||
    !arraysEqual(saved.stageAllowlist, current.stageAllowlist) ||
    !arraysEqual(saved.sectorAllowlist, current.sectorAllowlist) ||
    !arraysEqual(saved.sectorBlocklist, current.sectorBlocklist) ||
    !arraysEqual(saved.geoAllowlist, current.geoAllowlist)
  );
}

function arraysEqual(a: string[] | null, b: string[] | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
