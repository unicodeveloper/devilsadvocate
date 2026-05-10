import type {
  Citation,
  Finding,
  FundHouseViewRuleEvaluation,
  FundSynthesizedMemo,
  HoldingRef,
} from "@/lib/agents/types";
import { Badge } from "./ui";
import type { ComponentProps } from "react";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const CONFIDENCE_TONE: Record<"high" | "medium" | "low", BadgeTone> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};

const VERDICT_STYLES: Record<"pass" | "fail" | "mixed" | "n_a", string> = {
  pass: "text-success",
  fail: "text-danger",
  mixed: "text-warning",
  n_a: "text-text-subtle",
};

const FINAL_VERDICT_ACCENT: Record<
  "constructive" | "cautious" | "avoid" | "inconclusive",
  string
> = {
  constructive: "var(--success)",
  cautious: "var(--warning)",
  avoid: "var(--danger)",
  inconclusive: "var(--text-subtle)",
};

const FINAL_VERDICT_TONE: Record<
  "constructive" | "cautious" | "avoid" | "inconclusive",
  BadgeTone
> = {
  constructive: "success",
  cautious: "warning",
  avoid: "danger",
  inconclusive: "neutral",
};

export function FundMemoView({ memo }: { memo: FundSynthesizedMemo }) {
  return (
    <div className="flex flex-col gap-6">
      <FinalVerdict memo={memo} />
      <Setup memo={memo} />
      <PortfolioComposition memo={memo} />
      <HouseViewOverlay memo={memo} />
      <StressTest memo={memo} />
    </div>
  );
}

function FinalVerdict({ memo }: { memo: FundSynthesizedMemo }) {
  const v = memo.finalVerdict;
  const accent = FINAL_VERDICT_ACCENT[v.label];
  return (
    <div
      style={{ "--card-accent": accent } as React.CSSProperties}
      className="relative overflow-hidden rounded-lg border border-border bg-surface p-5"
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1 bg-[var(--card-accent)]"
      />
      <div className="pl-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">
            Final verdict
          </span>
          <span
            className="text-xl font-semibold capitalize tracking-tight"
            style={{ color: accent }}
          >
            {v.label}
          </span>
          <Badge tone={CONFIDENCE_TONE[v.confidence]}>
            {v.confidence} confidence
          </Badge>
          <Badge tone={FINAL_VERDICT_TONE[v.label]} dot>
            stress-tested
          </Badge>
        </div>
        <p className="mt-2 text-sm leading-6 text-text-muted">{v.reasoning}</p>
      </div>
    </div>
  );
}

function Setup({ memo }: { memo: FundSynthesizedMemo }) {
  return (
    <Section title="The Setup">
      <p className="text-sm leading-6 text-text">{memo.setup.summary}</p>
      {memo.setup.keyMetrics.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {memo.setup.keyMetrics.map((m, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-surface-2 p-3"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">
                {m.label}
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold text-text tabular-nums">
                {m.value}
              </dd>
              {m.source ? (
                <CitationLink className="mt-1.5" citation={m.source} />
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}
    </Section>
  );
}

function PortfolioComposition({ memo }: { memo: FundSynthesizedMemo }) {
  const { headline, sectorTilts, topHoldingsCommentary } = memo.portfolioComposition;
  return (
    <Section title="Portfolio Composition">
      <p className="text-sm font-medium text-text">{headline}</p>
      {sectorTilts.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-md border border-border bg-surface-2">
          <table className="w-full text-sm">
            <thead className="bg-surface-3 text-left text-[10px] font-medium uppercase tracking-wider text-text-subtle">
              <tr>
                <th className="px-3 py-2">Sector</th>
                <th className="px-3 py-2 text-right">Weight</th>
                <th className="px-3 py-2">Commentary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sectorTilts.map((s, i) => (
                <tr key={i} className="transition-colors hover:bg-surface-3/40">
                  <td className="px-3 py-2 text-text">{s.sector}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-text tabular-nums">
                    {s.weightPct.toFixed(2)}%
                  </td>
                  <td className="px-3 py-2 text-text-muted">{s.commentary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {topHoldingsCommentary.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">
            Top-holding commentary
          </h3>
          <ul className="mt-2 flex flex-col gap-2.5">
            {topHoldingsCommentary.map((f, i) => (
              <FindingRow key={i} finding={f} />
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function HouseViewOverlay({ memo }: { memo: FundSynthesizedMemo }) {
  const { headline, body, ruleVerdicts } = memo.houseViewOverlay;
  return (
    <Section title="House View Overlay">
      <p className="text-sm font-medium text-text">{headline}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
      {ruleVerdicts.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {ruleVerdicts.map((r, i) => (
            <RuleEvaluationRow key={i} evaluation={r} />
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function RuleEvaluationRow({
  evaluation,
}: {
  evaluation: FundHouseViewRuleEvaluation;
}) {
  return (
    <li className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-text">{evaluation.rule}</p>
        <div className="flex items-center gap-2">
          {evaluation.weightedViolationPct > 0 ? (
            <span className="font-mono text-[11px] text-danger tabular-nums">
              {evaluation.weightedViolationPct.toFixed(2)}% in violation
            </span>
          ) : null}
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider ${VERDICT_STYLES[evaluation.verdict]}`}
          >
            {evaluation.verdict === "n_a" ? "N/A" : evaluation.verdict}
          </span>
        </div>
      </div>
      <p className="mt-1 text-sm leading-6 text-text-muted">
        {evaluation.reasoning}
      </p>
      {evaluation.violatingHoldings.length > 0 ? (
        <ViolatingHoldingsTable rows={evaluation.violatingHoldings} />
      ) : null}
      {evaluation.evidence?.length ? (
        <CitationList className="mt-2" citations={evaluation.evidence} />
      ) : null}
    </li>
  );
}

function ViolatingHoldingsTable({ rows }: { rows: HoldingRef[] }) {
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)]">
      <table className="w-full text-xs">
        <thead className="bg-danger-soft text-left text-[10px] font-medium uppercase tracking-wider text-danger">
          <tr>
            <th className="px-3 py-1.5">Ticker</th>
            <th className="px-3 py-1.5">Name</th>
            <th className="px-3 py-1.5 text-right">Weight</th>
            <th className="px-3 py-1.5">Why it violates</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[color-mix(in_oklab,var(--danger)_15%,transparent)]">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-3 py-1.5 font-mono font-semibold text-text">
                {r.ticker}
              </td>
              <td className="px-3 py-1.5 text-text-muted">{r.name}</td>
              <td className="px-3 py-1.5 text-right font-mono text-text tabular-nums">
                {r.weightPct.toFixed(2)}%
              </td>
              <td className="px-3 py-1.5 text-text-muted">{r.reason ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StressTest({ memo }: { memo: FundSynthesizedMemo }) {
  const { summary, findings, blindSpots } = memo.stressTest;
  return (
    <Section title="The Reasoning Stress-Test" emphasis>
      <p className="text-sm leading-6 text-text">{summary}</p>
      <ul className="mt-4 flex flex-col gap-3">
        {findings.map((f, i) => (
          <FindingRow key={i} finding={f} />
        ))}
      </ul>
      {blindSpots.length > 0 ? (
        <div className="mt-5 rounded-md border border-border bg-surface-2 p-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">
            Blind spots — investigate further
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-snug text-text-muted">
            {blindSpots.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 inline-block h-1 w-1 rounded-full bg-text-subtle"
                />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Section>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <li className="rounded-md border border-border bg-surface-2 p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-text">{finding.title}</p>
        <Badge tone={CONFIDENCE_TONE[finding.confidence]}>
          {finding.confidence}
        </Badge>
      </div>
      <p className="mt-1 text-sm leading-6 text-text-muted">{finding.body}</p>
      <p className="mt-2 text-[11px] italic text-text-subtle">
        Evidence basis: {finding.evidenceBasis}
      </p>
      <CitationList className="mt-2" citations={finding.citations} />
    </li>
  );
}

function CitationList({
  citations,
  className,
}: {
  citations: Citation[];
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {citations.map((c, i) => (
        <li key={i}>
          <CitationLink citation={c} />
        </li>
      ))}
    </ul>
  );
}

function CitationLink({
  citation,
  className,
}: {
  citation: Citation;
  className?: string;
}) {
  const isUrl = /^https?:\/\//.test(citation.url);
  const label = citation.title ?? new URL(citation.url, "http://_").hostname;
  const tooltip = citation.quote ?? undefined;
  return isUrl ? (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-text-muted transition-colors hover:border-accent hover:text-accent ${className ?? ""}`}
      title={tooltip}
    >
      <svg
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 7h10v10" />
        <path d="M7 17 17 7" />
      </svg>
      {label}
    </a>
  ) : (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] italic text-text-subtle ${className ?? ""}`}
      title={tooltip}
    >
      {citation.url}
    </span>
  );
}

function Section({
  title,
  children,
  emphasis,
}: {
  title: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <section
      className={`rounded-lg border bg-surface p-5 ${emphasis ? "border-border-strong" : "border-border"}`}
    >
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wider text-text-subtle">
        {title}
      </h2>
      {children}
    </section>
  );
}
