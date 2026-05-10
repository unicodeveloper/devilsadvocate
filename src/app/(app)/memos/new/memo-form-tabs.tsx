"use client";

import { useState } from "react";
import { MemoForm } from "./memo-form";
import { FundMemoForm, type FundOption } from "./fund-memo-form";
import { cn } from "@/components/ui/cn";

export function MemoFormTabs({ funds }: { funds: FundOption[] }) {
  const [tab, setTab] = useState<"stock" | "fund">("stock");

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" className="flex border-b border-border">
        <TabButton active={tab === "stock"} onClick={() => setTab("stock")}>
          Stock memo
        </TabButton>
        <TabButton active={tab === "fund"} onClick={() => setTab("fund")}>
          Fund memo
        </TabButton>
      </div>
      {tab === "stock" ? <MemoForm /> : <FundMemoForm funds={funds} />}
    </div>
  );
}

function TabButton({
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
        "relative -mb-px px-4 py-2.5 text-sm font-medium transition-colors",
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
