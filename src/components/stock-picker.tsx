"use client";

import { useEffect, useRef, useState } from "react";
import type { StockSearchResult } from "@/lib/stocks";

export type SelectedStock = {
  ticker: string;
  name: string;
  exchange?: string;
  sector?: string;
};

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export function StockPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: SelectedStock | null;
  onSelect: (s: SelectedStock) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState(false);
  const [tickerOverride, setTickerOverride] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (selected) return;
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;

    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/stocks/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const data = (await res.json()) as { results: StockSearchResult[] };
        setResults(data.results ?? []);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError(e instanceof Error ? e.message : "lookup failed");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, selected]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5">
        <div className="flex items-baseline gap-3">
          {editingTicker ? (
            <input
              autoFocus
              value={tickerOverride}
              onChange={(e) => setTickerOverride(e.target.value.toUpperCase())}
              onBlur={() => {
                if (tickerOverride.trim()) {
                  onSelect({ ...selected, ticker: tickerOverride.trim() });
                }
                setEditingTicker(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="rounded border border-border bg-surface px-2 py-0.5 font-mono text-sm text-text"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTickerOverride(selected.ticker);
                setEditingTicker(true);
              }}
              className="font-mono text-sm font-semibold tracking-tight text-text transition-colors hover:text-accent"
              title="Click to edit ticker"
            >
              {selected.ticker}
            </button>
          )}
          <span className="text-sm text-text-muted">{selected.name}</span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-text-muted transition-colors hover:text-text"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search any stock — AAPL, Microsoft, Maruti…"
        className={INPUT_CLS}
      />
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-text-subtle">
          <Spinner />
          Looking up ticker…
        </div>
      ) : null}
      {error ? <div className="text-xs text-danger">{error}</div> : null}
      {results.length > 0 ? (
        <ul className="overflow-hidden rounded-md border border-border bg-surface">
          {results.map((r, idx) => (
            <li
              key={`${r.ticker}-${idx}`}
              className={idx > 0 ? "border-t border-border" : undefined}
            >
              <button
                type="button"
                onClick={() =>
                  onSelect({
                    ticker: r.ticker,
                    name: r.name,
                    exchange: r.exchange,
                    sector: r.sector,
                  })
                }
                className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-xs font-semibold text-text">
                    {r.ticker}
                  </span>
                  <span className="truncate text-text-muted">{r.name}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-subtle">
                  {r.exchange ? <span>{r.exchange}</span> : null}
                  {r.sector ? <span>· {r.sector}</span> : null}
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim().length >= 1 && !loading && results.length === 0 && !error ? (
        <p className="text-xs text-text-subtle">
          No matches. You can also enter the ticker directly below.
        </p>
      ) : null}
      {query.trim().length >= 1 && !loading ? (
        <button
          type="button"
          onClick={() =>
            onSelect({ ticker: query.toUpperCase().trim(), name: query.trim() })
          }
          className="self-start text-xs text-text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
        >
          Use &ldquo;{query}&rdquo; as-is
        </button>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="11"
      height="11"
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
