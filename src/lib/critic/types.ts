import { z } from "zod";
import {
  CitationSchema,
  type BearAdvocateOutput,
  type BullAdvocateOutput,
  type FundBearAdvocateOutput,
  type FundBullAdvocateOutput,
  type FundHouseViewCheckerOutput,
  type FundSynthesizedMemo,
  type HouseViewCheckerOutput,
  type SynthesizedMemo,
} from "../agents/types";
import type { Memo } from "../db/schema";

export const OBJECTION_TYPES = [
  "house_view_violation",
  "data_contradiction",
  "unsupported_claim",
  "consensus_divergence",
  "private_peer_threat",
  "macro_risk",
  "thesis_incoherence",
  "blind_spot",
] as const;
export type ObjectionType = (typeof OBJECTION_TYPES)[number];

export const SEVERITIES = ["BLOCKING", "MAJOR", "MINOR", "INFO"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ANCHOR_SECTIONS = [
  "thesis",
  "areas_of_concern",
  "private_peers",
  "holdings",
  "memo",
] as const;
export type AnchorSection = (typeof ANCHOR_SECTIONS)[number];

export const EvidenceSchema = z.object({
  source: CitationSchema,
  excerpt: z.string().nullable(),
  contradicts: z.string().nullable(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export type ObjectionDraft = {
  type: ObjectionType;
  severity: Severity;
  anchorSection: AnchorSection;
  anchorExcerpt: string | null;
  title: string;
  body: string;
  recommendation: string | null;
  evidence: Evidence[];
  ruleSlug: string;
};

export type Decision = "approved" | "changes_requested" | "rejected";

export type Verdict = {
  decision: Decision;
  confidence: number; // 0..1
  summary: string;
  objections: ObjectionDraft[];
  passedRuleSlugs: string[];
};

export type StockAgentOutputs = {
  kind: "stock";
  bull: BullAdvocateOutput;
  bear: BearAdvocateOutput;
  houseView: HouseViewCheckerOutput;
  synth: SynthesizedMemo;
};

export type FundAgentOutputs = {
  kind: "fund";
  bull: FundBullAdvocateOutput;
  bear: FundBearAdvocateOutput;
  houseView: FundHouseViewCheckerOutput;
  synth: FundSynthesizedMemo;
};

export type AgentOutputs = StockAgentOutputs | FundAgentOutputs;

export type RuleContext = {
  memo: Memo;
  outputs: AgentOutputs;
  houseViewMarkdown: string;
};

/**
 * Rule evaluators may be sync (built-in code rules) or async (AI rules that
 * call an LLM). The engine awaits all results.
 */
export type RuleEvaluator = (
  ctx: RuleContext,
) => ObjectionDraft[] | Promise<ObjectionDraft[]>;

export type RuleDefinition = {
  slug: string;
  displayName: string;
  description: string;
  severity: "HARD" | "SOFT";
  source: "house_view" | "builtin" | "custom";
  scope: "stock" | "fund" | "both";
  rationaleTemplate: string | null;
  evaluator: RuleEvaluator;
};

/**
 * Map from objection severity to the decision impact. Used by the engine to
 * compute the final verdict from the union of objections.
 */
export const SEVERITY_BLOCKS_HARD: Record<Severity, boolean> = {
  BLOCKING: true,
  MAJOR: false,
  MINOR: false,
  INFO: false,
};

export const SEVERITY_REQUIRES_CHANGES: Record<Severity, boolean> = {
  BLOCKING: true,
  MAJOR: true,
  MINOR: false,
  INFO: false,
};

export const ENGINE_VERSION = "1.0.0";
