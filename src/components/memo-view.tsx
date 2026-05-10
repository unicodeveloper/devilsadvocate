import type {
  Citation,
  Finding,
  HouseViewRuleEvaluation,
  SynthesizedMemo,
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

export function MemoView({ memo }: { memo: SynthesizedMemo }) {
  return (
    <div className="flex flex-col gap-6">
      <FinalVerdict memo={memo} />
      <Setup memo={memo} />
      <HouseViewOverlay memo={memo} />
      <StressTest memo={memo} />
      <Consensus memo={memo} />
    </div>
  );
}

function FinalVerdict({ memo }: { memo: SynthesizedMemo }) {
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

function Setup({ memo }: { memo: SynthesizedMemo }) {
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

function HouseViewOverlay({ memo }: { memo: SynthesizedMemo }) {
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

function StressTest({ memo }: { memo: SynthesizedMemo }) {
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

function Consensus({ memo }: { memo: SynthesizedMemo }) {
  const { headline, notes } = memo.consensusSummary;
  return (
    <Section title="Consensus Summary">
      <p className="text-sm leading-6 text-text">{headline}</p>
      {notes && notes.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2.5">
          {notes.map((f, i) => (
            <FindingRow key={i} finding={f} compact />
          ))}
        </ul>
      ) : null}
    </Section>
  );
}

function FindingRow({
  finding,
  compact,
}: {
  finding: Finding;
  compact?: boolean;
}) {
  return (
    <li
      className={`rounded-md border border-border bg-surface-2 ${compact ? "p-3" : "p-3.5"}`}
    >
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
