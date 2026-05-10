import type { Confidence } from "../../agents/types";
import type {
  Evidence,
  ObjectionDraft,
  RuleDefinition,
  Severity,
} from "../types";

const confidenceToSeverity = (c: Confidence): Severity =>
  c === "high" ? "MAJOR" : c === "medium" ? "MAJOR" : "MINOR";

const evidenceFromCitations = (
  cites: Array<{ url: string; title: string | null; quote: string | null }>,
  contradicts: string | null = null,
): Evidence[] =>
  cites.map((c) => ({
    source: { url: c.url, title: c.title ?? null, quote: c.quote ?? null },
    excerpt: c.quote,
    contradicts,
  }));

// ============================================================================
// HARD RULES — violations cause REJECTED verdict
// ============================================================================

const houseViewHardRule: RuleDefinition = {
  slug: "hv-rule-violation",
  displayName: "House View rule violation",
  description:
    "Any thesis that violates a hard House View rule must be rejected — no amount of editing can ship it without rewriting the underlying premise.",
  severity: "HARD",
  source: "house_view",
  scope: "stock",
  rationaleTemplate: "House View rule '{rule}' was evaluated as fail.",
  evaluator: (ctx) => {
    if (ctx.outputs.kind !== "stock") return [];
    const drafts: ObjectionDraft[] = [];
    for (const ev of ctx.outputs.houseView.ruleEvaluations) {
      if (ev.verdict !== "fail") continue;
      drafts.push({
        type: "house_view_violation",
        severity: "BLOCKING",
        anchorSection: "thesis",
        anchorExcerpt: null,
        title: `Violates House View rule: ${ev.rule}`,
        body: ev.reasoning,
        recommendation:
          "Revise the underlying premise — pick a different ticker or propose a House View change first.",
        evidence: evidenceFromCitations(ev.evidence ?? []),
        ruleSlug: "hv-rule-violation",
      });
    }
    return drafts;
  },
};

const fundHouseViewHardRule: RuleDefinition = {
  slug: "hv-fund-rule-violation",
  displayName: "House View rule violation (fund)",
  description:
    "A fund whose holdings violate a hard House View rule by more than 5% of NAV is rejected. Mixed-violation funds at lower weights surface as Changes Requested.",
  severity: "HARD",
  source: "house_view",
  scope: "fund",
  rationaleTemplate:
    "House View rule '{rule}' violated by {weightedViolationPct}% of NAV.",
  evaluator: (ctx) => {
    if (ctx.outputs.kind !== "fund") return [];
    const drafts: ObjectionDraft[] = [];
    for (const ev of ctx.outputs.houseView.ruleEvaluations) {
      const violatesHard =
        ev.verdict === "fail" || (ev.verdict === "mixed" && ev.weightedViolationPct >= 5);
      if (!violatesHard) continue;
      drafts.push({
        type: "house_view_violation",
        severity: "BLOCKING",
        anchorSection: "holdings",
        anchorExcerpt: null,
        title: `Fund violates House View rule: ${ev.rule}`,
        body: `${ev.reasoning} (${ev.weightedViolationPct.toFixed(1)}% of NAV)`,
        recommendation:
          "Reduce or rotate out of the violating holdings, or propose a House View exception.",
        evidence: evidenceFromCitations(ev.evidence ?? []),
        ruleSlug: "hv-fund-rule-violation",
      });
    }
    return drafts;
  },
};

const memoCompletenessRule: RuleDefinition = {
  slug: "memo-completeness",
  displayName: "Memo completeness",
  description:
    "Thesis must be substantial enough to evaluate. Anything under 30 characters is treated as a stub, not a thesis.",
  severity: "HARD",
  source: "builtin",
  scope: "both",
  rationaleTemplate: "Thesis is too short ({length} chars).",
  evaluator: (ctx) => {
    const len = ctx.memo.thesis.trim().length;
    if (len >= 30) return [];
    return [
      {
        type: "thesis_incoherence",
        severity: "BLOCKING",
        anchorSection: "thesis",
        anchorExcerpt: ctx.memo.thesis.slice(0, 80) || null,
        title: "Thesis is too short to evaluate",
        body: `The thesis is only ${len} characters. Add specifics: what's the call, what's the time horizon, what's the conviction-driving evidence?`,
        recommendation:
          "Expand the thesis to at least 30 characters with a clear directional view.",
        evidence: [],
        ruleSlug: "memo-completeness",
      },
    ];
  },
};

// ============================================================================
// SOFT RULES — violations cause CHANGES_REQUESTED verdict (or APPROVED with notes)
// ============================================================================

const bearFindingsRule: RuleDefinition = {
  slug: "bear-advocate-findings",
  displayName: "Bear advocate findings",
  description:
    "Every concrete risk surfaced by the Bear Advocate becomes an objection. Severity is derived from the agent's stated confidence.",
  severity: "SOFT",
  source: "builtin",
  scope: "both",
  rationaleTemplate: null,
  evaluator: (ctx) => {
    const findings =
      ctx.outputs.kind === "stock"
        ? ctx.outputs.bear.risks
        : [
            ...ctx.outputs.bear.weakHoldingsFlags,
            ...ctx.outputs.bear.macroOrSectorRisks,
            ...ctx.outputs.bear.concentrationRisks,
          ];
    return findings.map((f): ObjectionDraft => {
      const isMacro = /macro|inflation|currency|crude|rates|commodity/i.test(
        f.title + " " + f.body,
      );
      const isPeer = /peer|competitor|private|tracxn|vccedge/i.test(
        f.title + " " + f.body,
      );
      const type = isMacro
        ? "macro_risk"
        : isPeer
          ? "private_peer_threat"
          : "data_contradiction";
      return {
        type,
        severity: confidenceToSeverity(f.confidence),
        anchorSection: "thesis",
        anchorExcerpt: null,
        title: f.title,
        body: f.body,
        recommendation:
          "Address this risk inline in the memo (Areas of Concern) or dispute with reasoning.",
        evidence: evidenceFromCitations(f.citations),
        ruleSlug: "bear-advocate-findings",
      };
    });
  },
};

const consensusDivergenceRule: RuleDefinition = {
  slug: "consensus-divergence-disclosed",
  displayName: "Consensus divergence disclosed",
  description:
    "When the thesis diverges from House View consensus, the divergence must be acknowledged in the memo's Areas of Concern.",
  severity: "SOFT",
  source: "builtin",
  scope: "both",
  rationaleTemplate: null,
  evaluator: (ctx) => {
    const divergence = ctx.outputs.houseView.divergence;
    if (!divergence) return [];
    const acknowledges =
      ctx.memo.areasOfConcern &&
      ctx.memo.areasOfConcern.toLowerCase().includes("house view");
    if (acknowledges) return [];
    return [
      {
        type: "consensus_divergence",
        severity: "MAJOR",
        anchorSection: "areas_of_concern",
        anchorExcerpt: null,
        title: "Divergence from House View not acknowledged",
        body: divergence,
        recommendation:
          "Mention the House View divergence and your counter-argument in Areas of Concern.",
        evidence: [],
        ruleSlug: "consensus-divergence-disclosed",
      },
    ];
  },
};

const blindSpotsRule: RuleDefinition = {
  slug: "bear-blind-spots",
  displayName: "Open questions from Bear Advocate",
  description:
    "Open questions the Bear Advocate flagged but couldn't resolve. Advisory — never blocks approval, but worth surfacing.",
  severity: "SOFT",
  source: "builtin",
  scope: "both",
  rationaleTemplate: null,
  evaluator: (ctx) => {
    return ctx.outputs.bear.blindSpots.map(
      (q): ObjectionDraft => ({
        type: "blind_spot",
        severity: "INFO",
        anchorSection: "memo",
        anchorExcerpt: null,
        title: q.length > 80 ? q.slice(0, 77) + "..." : q,
        body: q,
        recommendation: "Worth investigating before IC, but not a blocker.",
        evidence: [],
        ruleSlug: "bear-blind-spots",
      }),
    );
  },
};

export const BUILTIN_RULES: RuleDefinition[] = [
  houseViewHardRule,
  fundHouseViewHardRule,
  memoCompletenessRule,
  bearFindingsRule,
  consensusDivergenceRule,
  blindSpotsRule,
];

export const RULES_BY_SLUG: Record<string, RuleDefinition> = Object.fromEntries(
  BUILTIN_RULES.map((r) => [r.slug, r]),
);
