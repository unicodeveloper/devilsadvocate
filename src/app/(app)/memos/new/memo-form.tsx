"use client";

import { useRef, useState, useTransition } from "react";
import { StockPicker, type SelectedStock } from "@/components/stock-picker";
import { useSignIn } from "@/components/sign-in-provider";
import { Button, Chip } from "@/components/ui";
import { createMemoAction } from "./actions";

type PeerSuggestion = { name: string; rationale: string };

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

function parsePeerCsv(raw: string): string[] {
  return raw
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isSelected(peers: string, name: string): boolean {
  const target = name.toLowerCase();
  return parsePeerCsv(peers).some((p) => p.toLowerCase() === target);
}

function togglePeer(peers: string, name: string): string {
  const list = parsePeerCsv(peers);
  const target = name.toLowerCase();
  const idx = list.findIndex((p) => p.toLowerCase() === target);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(name);
  }
  return list.join(", ");
}

export function MemoForm() {
  const [stock, setStock] = useState<SelectedStock | null>(null);
  const [thesis, setThesis] = useState("");
  const [areas, setAreas] = useState("");
  const [peers, setPeers] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { isAuthed, requireAuth, user } = useSignIn();

  const [suggest, setSuggest] = useState<{
    list: PeerSuggestion[];
    loading: boolean;
  }>({ list: [], loading: false });
  const suggestAbortRef = useRef<AbortController | null>(null);

  function handleSelectStock(s: SelectedStock) {
    setStock(s);
    suggestAbortRef.current?.abort();
    const ctrl = new AbortController();
    suggestAbortRef.current = ctrl;
    setSuggest({ list: [], loading: true });

    fetch("/api/stocks/private-competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: s.ticker,
        name: s.name,
        sector: s.sector ?? null,
      }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) return { competitors: [] as PeerSuggestion[] };
        return (await res.json()) as { competitors: PeerSuggestion[] };
      })
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setSuggest({ list: data.competitors ?? [], loading: false });
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") return;
        setSuggest({ list: [], loading: false });
      });
  }

  function handleClearStock() {
    setStock(null);
    suggestAbortRef.current?.abort();
    setSuggest({ list: [], loading: false });
  }

  const thesisLen = thesis.trim().length;
  const thesisShort = thesisLen > 0 && thesisLen < 10;
  const canSubmit = stock && thesisLen >= 10 && !isPending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stock) return;
    setError(null);
    if (!isAuthed) {
      requireAuth({ reason: "Sign in as a Fund Manager to create a memo." });
      return;
    }
    if (user?.role !== "fund_manager") {
      setError("Only Fund Managers can create memos.");
      return;
    }
    const fd = new FormData();
    fd.set("stockTicker", stock.ticker);
    fd.set("stockName", stock.name);
    if (stock.exchange) fd.set("stockExchange", stock.exchange);
    if (stock.sector) fd.set("stockSector", stock.sector);
    fd.set("thesis", thesis);
    if (areas.trim()) fd.set("areasOfConcern", areas);
    if (peers.trim()) fd.set("privatePeers", peers);

    startTransition(async () => {
      try {
        await createMemoAction(fd);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create memo");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Field
        label="Stock"
        required
        helper="Click a search result to select it — typing alone won't pick the stock."
      >
        <StockPicker
          selected={stock}
          onSelect={handleSelectStock}
          onClear={handleClearStock}
        />
      </Field>

      <Field
        label="Thesis"
        required
        helper="State your bullish (or bearish) view in 2-4 sentences. The Devil's Advocate will stress-test it."
      >
        <textarea
          value={thesis}
          onChange={(e) => setThesis(e.target.value)}
          placeholder="e.g. Maruti Suzuki should compound 18% over 3 years on premium-mix shift, distribution moat, and rural recovery."
          rows={4}
          className={INPUT_CLS}
        />
        {thesisShort ? (
          <FieldHint tone="warning">
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
          placeholder="e.g. EV transition risk, rural demand softness, raw-material cost cycles."
          rows={3}
          className={INPUT_CLS}
        />
      </Field>

      <Field
        label="Private competitors"
        optional
        optionalNote="up to 5"
        helper="Comma-separated. The Bear Advocate will research each competitor (funding, traction, strategic moves) and use them as evidence against the thesis."
      >
        <input
          value={peers}
          onChange={(e) => setPeers(e.target.value)}
          placeholder="e.g. Ola Electric, Ather Energy, Greaves Electric Mobility"
          className={INPUT_CLS}
        />

        {stock && (suggest.loading || suggest.list.length > 0) ? (
          <div className="mt-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-subtle">
              {suggest.loading
                ? "Finding private competitors…"
                : `Suggested for ${stock.ticker}`}
            </p>
            {suggest.loading ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <div className="h-7 w-24 animate-pulse rounded-full bg-surface-2" />
                <div className="h-7 w-32 animate-pulse rounded-full bg-surface-2" />
                <div className="h-7 w-20 animate-pulse rounded-full bg-surface-2" />
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {suggest.list.map((s) => (
                  <Chip
                    key={s.name}
                    title={s.rationale}
                    active={isSelected(peers, s.name)}
                    onClick={() => setPeers((p) => togglePeer(p, s.name))}
                  >
                    {s.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        ) : null}
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
        <Button type="submit" disabled={!canSubmit} loading={isPending} size="lg">
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
  optionalNote,
  helper,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  optionalNote?: string;
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

function FieldHint({
  children,
  tone = "warning",
}: {
  children: React.ReactNode;
  tone?: "warning" | "danger";
}) {
  const cls =
    tone === "danger"
      ? "text-danger"
      : "text-warning";
  return (
    <p className={`mt-0.5 inline-flex items-center gap-1.5 text-[11px] leading-snug ${cls}`}>
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
