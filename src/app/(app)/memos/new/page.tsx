import Link from "next/link";
import { listFunds, listHoldingsForFund } from "@/lib/funds";
import { MemoFormTabs } from "./memo-form-tabs";
import type { FundOption } from "./fund-memo-form";

export const dynamic = "force-dynamic";

export default async function NewMemoPage() {
  const funds = await listFunds();
  const fundOptions: FundOption[] = await Promise.all(
    funds.map(async (f) => {
      const h = await listHoldingsForFund(f.id);
      return {
        id: f.id,
        name: f.name,
        type: f.type,
        fundManager: f.fundManager,
        holdingsCount: h.length,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/memos"
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
        All memos
      </Link>
      <div className="mb-6 mt-3 border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          New memo
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Submit a stock or fund. Mandate will challenge your thesis using
          live research, peer data, House View rules, and (optionally) any
          broker reports you attach at run time.
        </p>
      </div>
      <MemoFormTabs funds={fundOptions} />
    </div>
  );
}
