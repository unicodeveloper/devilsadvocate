import { z } from "zod";

export const CitationSchema = z.object({
  url: z.string().describe("Source URL or document reference"),
  title: z
    .string()
    .nullable()
    .describe("Title of the source, or null if not available"),
  quote: z
    .string()
    .nullable()
    .describe(
      "Short quoted excerpt that supports the claim, or null if no exact quote available",
    ),
});
export type Citation = z.infer<typeof CitationSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const FindingSchema = z.object({
  title: z.string().describe("One-line summary of the finding"),
  body: z
    .string()
    .describe("2-4 sentence explanation with concrete numbers where possible"),
  citations: z
    .array(CitationSchema)
    .min(1)
    .describe(
      "REQUIRED: at least one citation. Findings without citations are stripped.",
    ),
  confidence: ConfidenceSchema.describe(
    "high = independently corroborated; medium = single credible source; low = inferred or speculative",
  ),
  evidenceBasis: z
    .string()
    .describe("One short line on why this confidence level was chosen"),
});
export type Finding = z.infer<typeof FindingSchema>;

export const BullAdvocateOutputSchema = z.object({
  thesisRestated: z
    .string()
    .describe("The bull thesis in 1-2 sharp sentences"),
  supportingClaims: z
    .array(FindingSchema)
    .min(1)
    .describe("Concrete data points and arguments supporting the thesis"),
});
export type BullAdvocateOutput = z.infer<typeof BullAdvocateOutputSchema>;

export const BearAdvocateOutputSchema = z.object({
  contrarianSummary: z
    .string()
    .describe("2-3 sentence summary of why the bull case might be wrong"),
  risks: z
    .array(FindingSchema)
    .min(1)
    .describe(
      "Specific risks, contradictions, peer signals, or macro headwinds that undermine the thesis",
    ),
  blindSpots: z
    .array(z.string())
    .describe("Open questions the analyst should investigate further"),
});
export type BearAdvocateOutput = z.infer<typeof BearAdvocateOutputSchema>;

export const HouseViewVerdictSchema = z.enum(["pass", "fail", "n_a"]);

export const HouseViewRuleEvaluationSchema = z.object({
  rule: z.string().describe("The exact House View rule being evaluated"),
  verdict: HouseViewVerdictSchema,
  reasoning: z
    .string()
    .describe("How the thesis maps to the rule, with specifics"),
  evidence: z.array(CitationSchema).describe("Sources supporting the verdict"),
});
export type HouseViewRuleEvaluation = z.infer<
  typeof HouseViewRuleEvaluationSchema
>;

export const HouseViewCheckerOutputSchema = z.object({
  overallAlignment: z
    .enum(["aligned", "partially_aligned", "violates"])
    .describe("Headline read on whether the thesis fits the House View"),
  ruleEvaluations: z
    .array(HouseViewRuleEvaluationSchema)
    .describe("Per-rule verdict from the House View"),
  divergence: z
    .string()
    .nullable()
    .describe(
      "If the thesis diverges from the House View, summarize the divergence; otherwise null",
    ),
});
export type HouseViewCheckerOutput = z.infer<
  typeof HouseViewCheckerOutputSchema
>;

// ============================================================================
// FUND-MEMO SCHEMAS
// ============================================================================

export const HoldingRefSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  weightPct: z.number().describe("Holding weight as a percentage of NAV"),
  reason: z
    .string()
    .nullable()
    .describe("One-line reason this holding is being flagged"),
});
export type HoldingRef = z.infer<typeof HoldingRefSchema>;

export const FundBullAdvocateOutputSchema = z.object({
  thesisRestated: z.string().describe("The bull thesis in 1-2 sharp sentences"),
  strategyAlignment: z
    .string()
    .describe(
      "How the holdings align with the stated thesis — sector tilts, factor exposures, etc.",
    ),
  topPickRationales: z
    .array(FindingSchema)
    .min(1)
    .describe("Why each top holding is in the portfolio"),
  portfolioStrengths: z
    .array(FindingSchema)
    .describe(
      "Diversification, manager track record, fee structure — load-bearing positives",
    ),
});
export type FundBullAdvocateOutput = z.infer<typeof FundBullAdvocateOutputSchema>;

export const FundBearAdvocateOutputSchema = z.object({
  contrarianSummary: z
    .string()
    .describe("2-3 sentence summary of why this fund's thesis might be wrong"),
  concentrationRisks: z
    .array(FindingSchema)
    .describe(
      "Single-name or sector concentration that disproportionately drives outcomes",
    ),
  weakHoldingsFlags: z
    .array(FindingSchema)
    .describe(
      "Specific holdings with material risks (governance, financials, peer signals, regulatory) — cite each from research",
    ),
  macroOrSectorRisks: z
    .array(FindingSchema)
    .describe("Macro / sector headwinds the fund is exposed to"),
  blindSpots: z
    .array(z.string())
    .describe("Open questions to investigate further; no citations required"),
});
export type FundBearAdvocateOutput = z.infer<typeof FundBearAdvocateOutputSchema>;

export const FundHouseViewRuleEvaluationSchema = z.object({
  rule: z.string().describe("The exact House View rule being evaluated"),
  verdict: z
    .enum(["pass", "fail", "mixed", "n_a"])
    .describe(
      "pass = all relevant holdings comply; fail = all relevant holdings violate; mixed = some violate; n_a = rule not applicable to this fund",
    ),
  reasoning: z.string(),
  violatingHoldings: z
    .array(HoldingRefSchema)
    .describe("Holdings that violate this rule, with weights and reason"),
  weightedViolationPct: z
    .number()
    .describe("Sum of violating holdings' weights as percentage of NAV"),
  evidence: z.array(CitationSchema),
});
export type FundHouseViewRuleEvaluation = z.infer<
  typeof FundHouseViewRuleEvaluationSchema
>;

export const FundHouseViewCheckerOutputSchema = z.object({
  overallAlignment: z.enum(["aligned", "partially_aligned", "violates"]),
  ruleEvaluations: z.array(FundHouseViewRuleEvaluationSchema),
  totalViolationWeightPct: z
    .number()
    .describe("Aggregate weight of holdings that violate ANY rule"),
  divergence: z.string().nullable(),
});
export type FundHouseViewCheckerOutput = z.infer<
  typeof FundHouseViewCheckerOutputSchema
>;

export const FundSynthesizedMemoSchema = z.object({
  setup: z.object({
    summary: z.string().describe("2-3 sentence overview of the fund and thesis"),
    keyMetrics: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        source: CitationSchema.nullable(),
      }),
    ),
  }),
  portfolioComposition: z.object({
    headline: z
      .string()
      .describe(
        "One-line read on portfolio shape (e.g., '78% in top 10 — concentrated bet on Indian Auto')",
      ),
    sectorTilts: z
      .array(
        z.object({
          sector: z.string(),
          weightPct: z.number(),
          commentary: z.string(),
        }),
      )
      .describe("Notable sector tilts with brief commentary"),
    topHoldingsCommentary: z
      .array(FindingSchema)
      .describe("Per-top-holding remarks; cite sources when making claims"),
  }),
  houseViewOverlay: z.object({
    headline: z.string(),
    body: z.string(),
    ruleVerdicts: z.array(FundHouseViewRuleEvaluationSchema),
  }),
  stressTest: z.object({
    summary: z.string(),
    findings: z
      .array(FindingSchema)
      .describe("Devil's advocate findings, ordered by confidence then severity"),
    blindSpots: z.array(z.string()),
  }),
  finalVerdict: z.object({
    label: z.enum(["constructive", "cautious", "avoid", "inconclusive"]),
    reasoning: z.string(),
    confidence: ConfidenceSchema,
  }),
});
export type FundSynthesizedMemo = z.infer<typeof FundSynthesizedMemoSchema>;

// ============================================================================
// STOCK-MEMO SYNTHESIZED OUTPUT (existing)
// ============================================================================

export const SynthesizedMemoSchema = z.object({
  setup: z.object({
    summary: z
      .string()
      .describe("2-3 sentence overview of the stock and the thesis"),
    keyMetrics: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          source: CitationSchema.nullable(),
        }),
      )
      .describe("Quick-glance facts: market cap, sector, price, etc."),
  }),
  houseViewOverlay: z.object({
    headline: z
      .string()
      .describe(
        "One-line verdict: aligned / partially aligned / violates House View",
      ),
    body: z.string().describe("How the thesis maps to House View rules"),
    ruleVerdicts: z.array(HouseViewRuleEvaluationSchema),
  }),
  stressTest: z.object({
    summary: z
      .string()
      .describe("2-3 sentences explaining the strongest contrarian view"),
    findings: z
      .array(FindingSchema)
      .describe(
        "The Devil's Advocate findings, ordered by confidence then severity. Every entry MUST have at least one citation.",
      ),
    blindSpots: z.array(z.string()),
  }),
  consensusSummary: z.object({
    headline: z
      .string()
      .describe(
        "e.g. '8 of 10 brokers recommend Buy; 2 Sells cite regulatory risk'",
      ),
    notes: z
      .array(FindingSchema)
      .nullable()
      .describe(
        "Optional supporting notes with citations; null if not enough signal",
      ),
  }),
  finalVerdict: z.object({
    label: z.enum(["constructive", "cautious", "avoid", "inconclusive"]),
    reasoning: z.string(),
    confidence: ConfidenceSchema,
  }),
});
export type SynthesizedMemo = z.infer<typeof SynthesizedMemoSchema>;
