"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";

type Sector = string;
type GroupOption = { id: string; name: string; memberCount: number };

export type QueryType = "ticker" | "sector" | "group";

const INPUT_CLS =
  "flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none transition-colors placeholder:text-text-subtle hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-[var(--accent-ring)]";

export function ExposureForm({
  initialType,
  initialQ,
  initialId,
  sectors,
  groups,
  knownTickers,
}: {
  initialType: QueryType;
  initialQ: string;
  initialId: string;
  sectors: Sector[];
  groups: GroupOption[];
  knownTickers: { ticker: string; name: string }[];
}) {
  const router = useRouter();
  const [type, setType] = useState<QueryType>(initialType);
  const [q, setQ] = useState(initialQ);
  const [groupId, setGroupId] = useState(initialId || groups[0]?.id || "");
  const [sector, setSector] = useState(initialQ || sectors[0] || "");

  function go() {
    const params = new URLSearchParams();
    params.set("type", type);
    if (type === "ticker" && q.trim())
      params.set("q", q.trim().toUpperCase());
    if (type === "sector" && sector) params.set("q", sector);
    if (type === "group" && groupId) params.set("id", groupId);
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            list="known-tickers"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. TSLA, MSFT, ADANIPORTS.NS"
            className={cn(INPUT_CLS, "font-mono")}
            onKeyDown={(e) => e.key === "Enter" && go()}
          />
          <datalist id="known-tickers">
            {knownTickers.map((t) => (
              <option key={t.ticker} value={t.ticker}>
                {t.name}
              </option>
            ))}
          </datalist>
          <Button onClick={go} disabled={!q.trim()}>
            Search
          </Button>
        </div>
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
          <Button onClick={go} disabled={!sector}>
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
          <Button onClick={go} disabled={!groupId}>
            Search
          </Button>
        </div>
      ) : null}
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
