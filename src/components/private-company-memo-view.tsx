import type {
  Citation,
  Finding,
  HouseViewRuleEvaluation,
  PrivateCompanyDataGap,
  PrivateCompanySynthesizedMemo,
} from "@/lib/agents/types";
import { Badge } from "./ui";
import type { ComponentProps } from "react";

type BadgeTone = NonNullable<ComponentProps<typeof Badge>["tone"]>;

const CONFIDENCE_TONE: Record<"high" | "medium" | "low", BadgeTone> = {
  high: "success",
  medium: "warning",
  low: "neutral",
};

const VERDICT_STYLES: Record<"pass" | "fail" | "n_a", string> = {
  pass: "text-success",
  fail: "text-danger",
  n_a: "text-text-subtle",
};

const FINAL_VERDICT_ACCENT: Record<
  "proceed" | "size_down" | "kill" | "inconclusive",
  string
> = {
  proceed: "var(--success)",
  size_down: "var(--warning)",
  kill: "var(--danger)",
  inconclusive: "var(--text-subtle)",
};

const FINAL_VERDICT_TONE: Record<
  "proceed" | "size_down" | "kill" | "inconclusive",
  BadgeTone
> = {
  proceed: "success",
  size_down: "warning",
  kill: "danger",
  inconclusive: "neutral",
};

const FINAL_VERDICT_LABEL: Record<
  "proceed" | "size_down" | "kill" | "inconclusive",
  string
> = {
  proceed: "Proceed",
  size_down: "Size down",
  kill: "Kill",
  inconclusive: "Inconclusive",
};

const DATA_GAP_LABEL: Record<PrivateCompanyDataGap["category"], string> = {
  financials: "Financials",
  traction: "Traction",
  retention: "Retention",
  unit_economics: "Unit economics",
  cap_table: "Cap table",
  team: "Team",
  legal: "Legal",
  customer_concentration: "Customer concentration",
  other: "Other",
};

export function PrivateCompanyMemoView({
  memo,
}: {
  memo: PrivateCompanySynthesizedMemo;
}) {
  return (
    <div className="flex flex-col gap-6">
      <FinalVerdict memo={memo} />
      <Setup memo={memo} />
      <HouseViewOverlay memo={memo} />
      <StressTest memo={memo} />
      <DataGaps gaps={memo.dataGaps} />
    </div>
  );
}

function FinalVerdict({ memo }: { memo: PrivateCompanySynthesizedMemo }) {
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
            className="text-xl font-semibold tracking-tight"
            style={{ color: accent }}
          >
            {FINAL_VERDICT_LABEL[v.label]}
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

function Setup({ memo }: { memo: PrivateCompanySynthesizedMemo }) {
  return (
    <Section title="The Setup">
      <p className="text-sm leading-6 text-text">{memo.setup.summary}</p>
      {memo.setup.keyFacts.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {memo.setup.keyFacts.map((m, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-surface-2 p-3"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wider text-text-subtle">
                {m.label}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-text">
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

function HouseViewOverlay({ memo }: { memo: PrivateCompanySynthesizedMemo }) {
  const { headline, body, ruleVerdicts, mechanicalViolations } =
    memo.houseViewOverlay;
  return (
    <Section title="House View Overlay">
      <p className="text-sm font-medium text-text">{headline}</p>
      <p className="mt-2 text-sm leading-6 text-text-muted">{body}</p>
      {mechanicalViolations.length > 0 ? (
        <div className="mt-4 rounded-md border border-danger/40 bg-danger-soft p-3">
          <h3 className="text-[10px] font-medium uppercase tracking-wider text-danger">
            Mandate violations
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-snug text-danger">
            {mechanicalViolations.map((v, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-2 inline-block h-1.5 w-1.5 rounded-full bg-danger"
                />
                <span>
                  <span className="font-mono text-[11px] uppercase opacity-80">
                    {v.field}:
                  </span>{" "}
                  {v.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
  evaluation: HouseViewRuleEvaluation;
}) {
  return (
    <li className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-text">{evaluation.rule}</p>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${VERDICT_STYLES[evaluation.verdict]}`}
        >
          {evaluation.verdict === "n_a" ? "N/A" : evaluation.verdict}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-text-muted">
        {evaluation.reasoning}
      </p>
      {evaluation.evidence?.length ? (
        <CitationList className="mt-2" citations={evaluation.evidence} />
      ) : null}
    </li>
  );
}

function StressTest({ memo }: { memo: PrivateCompanySynthesizedMemo }) {
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
            Blind spots — pressure-test on the founder call
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

function DataGaps({ gaps }: { gaps: PrivateCompanyDataGap[] }) {
  if (gaps.length === 0) {
    return null;
  }
  return (
    <Section title="Data-Room Requests" emphasis>
      <p className="text-sm leading-6 text-text-muted">
        Items the Devil&apos;s Advocate could not verify from public data. Ask
        the founder for these before you commit capital.
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {gaps.map((g, i) => (
          <li
            key={i}
            className="rounded-md border border-warning/30 bg-warning-soft/40 p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-text">{g.request}</p>
              <Badge tone="warning">{DATA_GAP_LABEL[g.category]}</Badge>
            </div>
            <p className="mt-1 text-sm leading-6 text-text-muted">{g.reason}</p>
          </li>
        ))}
      </ul>
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
