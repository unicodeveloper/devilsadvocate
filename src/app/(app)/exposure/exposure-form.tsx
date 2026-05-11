"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import type { StockSearchResult } from "@/lib/stocks";

type Sector = string;
type GroupOption = { id: string; name: string; memberCount: number };

export type QueryType = "ticker" | "sector" | "group";

const INPUT_CLS =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export function ExposureForm({
  initialType,
  initialQ,
  initialId,
  sectors,
  groups,
}: {
  initialType: QueryType;
  initialQ: string;
  initialId: string;
  sectors: Sector[];
  groups: GroupOption[];
}) {
  const router = useRouter();
  const [type, setType] = useState<QueryType>(initialType);
  const [q, setQ] = useState(initialQ);
  const [groupId, setGroupId] = useState(initialId || groups[0]?.id || "");
  const [sector, setSector] = useState(initialQ || sectors[0] || "");

  function navigate(nextQ?: string) {
    const params = new URLSearchParams();
    params.set("type", type);
    if (type === "ticker") {
      const raw = (nextQ ?? q).trim();
      if (raw) params.set("q", raw.toUpperCase());
    } else if (type === "sector" && sector) {
      params.set("q", sector);
    } else if (type === "group" && groupId) {
      params.set("id", groupId);
    }
    router.push(`/exposure?${params.toString()}`);
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div
        role="tablist"
        aria-label="Exposure query type"
        className="mb-4 flex border-b border-border"
      >
        <Tab active={type === "ticker"} onClick={() => setType("ticker")}>
          Ticker
        </Tab>
        <Tab active={type === "sector"} onClick={() => setType("sector")}>
          Sector
        </Tab>
        <Tab active={type === "group"} onClick={() => setType("group")}>
          Group
        </Tab>
      </div>

      {type === "ticker" ? (
        <TickerSearch
          value={q}
          onChange={setQ}
          onPick={(ticker) => {
            setQ(ticker);
            navigate(ticker);
          }}
          onSubmit={() => navigate()}
        />
      ) : null}

      {type === "sector" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className={INPUT_CLS}
          >
            {sectors.length === 0 ? (
              <option value="">No sectors found in any fund yet</option>
            ) : (
              sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            )}
          </select>
          <Button onClick={() => navigate()} disabled={!sector}>
            Search
          </Button>
        </div>
      ) : null}

      {type === "group" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className={INPUT_CLS}
          >
            {groups.length === 0 ? (
              <option value="">No groups defined</option>
            ) : (
              groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount})
                </option>
              ))
            )}
          </select>
          <Button onClick={() => navigate()} disabled={!groupId}>
            Search
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Typeahead backed by /api/stocks/search (Yahoo Finance). Same UX pattern
 * as <StockPicker> in components/stock-picker.tsx but optimized for the
 * exposure flow: pick a result → immediately navigate to the new
 * /exposure?q=… URL. Pressing Enter without picking a result also navigates,
 * so manual entry (e.g. exact ticker the user knows) still works.
 */
function TickerSearch({
  value,
  onChange,
  onPick,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (ticker: string) => void;
  onSubmit: () => void;
}) {
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced live search.
  useEffect(() => {
    if (value.trim().length < 1) {
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
          body: JSON.stringify({ query: value }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const data = (await res.json()) as { results: StockSearchResult[] };
        setResults(data.results ?? []);
        setActiveIdx(-1);
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
  }, [value]);

  // Click outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (open && activeIdx >= 0 && results[activeIdx]) {
        onPick(results[activeIdx].ticker);
        setOpen(false);
      } else {
        onSubmit();
      }
    }
  }

  const showDropdown =
    open && (loading || results.length > 0 || error !== null);

  return (
    <div ref={wrapRef} className="relative flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search any ticker — AAPL, Microsoft, ADANIPORTS.NS"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls="ticker-search-results"
          className={cn(INPUT_CLS, "font-mono")}
        />

        {showDropdown ? (
          <ul
            id="ticker-search-results"
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg"
          >
            {loading && results.length === 0 ? (
              <li className="px-3 py-2 text-xs text-text-subtle">
                Looking up tickers…
              </li>
            ) : null}
            {error ? (
              <li className="px-3 py-2 text-xs text-danger">{error}</li>
            ) : null}
            {results.map((r, idx) => {
              const active = idx === activeIdx;
              return (
                <li
                  key={`${r.ticker}-${idx}`}
                  role="option"
                  aria-selected={active}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick(r.ticker);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
                      active ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs font-semibold text-text">
                        {r.ticker}
                      </span>
                      <span className="truncate text-sm text-text-muted">
                        {r.name}
                      </span>
                    </div>
                    {r.exchange || r.sector ? (
                      <div className="flex items-center gap-2 text-[11px] text-text-subtle">
                        {r.exchange ? <span>{r.exchange}</span> : null}
                        {r.sector ? <span>· {r.sector}</span> : null}
                      </div>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {!loading && !error && results.length === 0 && value.trim() ? (
              <li className="px-3 py-2 text-xs text-text-subtle">
                No matches. Press Enter to search this ticker as typed.
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <Button onClick={onSubmit} disabled={!value.trim()}>
        Search
      </Button>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative -mb-px px-4 py-2 text-sm font-medium transition-colors",
        active ? "text-text" : "text-text-muted hover:text-text",
      )}
    >
      {children}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px h-px bg-accent shadow-[0_0_8px_var(--accent)]"
        />
      ) : null}
    </button>
  );
}
