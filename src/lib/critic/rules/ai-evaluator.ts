import { generateObject } from "ai";
import { z } from "zod";
import { getOpenAI, MODELS } from "../../openai";
import {
  ANCHOR_SECTIONS,
  SEVERITIES,
  type AnchorSection,
  type ObjectionDraft,
  type RuleContext,
  type RuleEvaluator,
  type Severity,
} from "../types";

export type AIEvaluatorConfig = {
  prompt: string;
  defaultSeverity: Severity;
};

const AIEvalOutputSchema = z.object({
  violated: z
    .boolean()
    .describe("Did the memo violate the rule? false = no objections to raise"),
  objections: z
    .array(
      z.object({
        title: z.string().describe("One-line headline of the objection (under 80 chars)"),
        body: z
          .string()
          .describe("2-4 sentences explaining what part of the memo violates the rule and why"),
        severity: z.enum(SEVERITIES),
        anchorSection: z.enum(ANCHOR_SECTIONS),
        evidenceQuote: z
          .string()
          .nullable()
          .describe("Verbatim excerpt from the memo that triggered the objection, or null"),
      }),
    )
    .describe("Objections to raise. Empty when violated = false."),
});

const SYSTEM = `You are a single-rule evaluator inside Devil's Advocate, the AI CIO that reviews investment memos.

Your job: judge whether a Fund Manager's memo violates ONE specific rule. The rule is given to you. You see the memo (thesis, areas of concern, stress-test findings) and decide.

Rules of engagement:
- If the memo does NOT violate the rule, return { violated: false, objections: [] }. Silence is valid and preferred.
- If it DOES violate, return one or more concrete objections. Be specific — quote the memo where possible.
- Pick severity carefully: BLOCKING means the memo cannot ship, MAJOR means it must be addressed before resubmit, MINOR means worth noting, INFO means advisory only.
- Prefer fewer, higher-quality objections over many speculative ones.
- Do not invent facts. Only cite what's actually in the memo.`;

function renderMemoContext(ctx: RuleContext): string {
  const parts: string[] = [];
  if (ctx.outputs.kind === "stock" && ctx.memo.stockTicker) {
    parts.push(`Subject: ${ctx.memo.stockTicker} (${ctx.memo.stockName ?? ""})`);
  } else {
    parts.push(`Subject: ${ctx.memo.entityType} memo`);
  }
  parts.push("", "## Thesis", ctx.memo.thesis);
  if (ctx.memo.areasOfConcern) {
    parts.push("", "## Areas of concern", ctx.memo.areasOfConcern);
  }
  if (ctx.memo.privatePeers) {
    parts.push("", "## Private competitors", ctx.memo.privatePeers);
  }
  parts.push("", "## Stress-test summary");
  parts.push(ctx.outputs.synth.stressTest.summary || "(no summary)");
  if (ctx.outputs.synth.stressTest.findings.length) {
    parts.push("", "Top stress-test findings:");
    for (const f of ctx.outputs.synth.stressTest.findings.slice(0, 5)) {
      parts.push(`- ${f.title}: ${f.body}`);
    }
  }
  return parts.join("\n");
}

/**
 * Build an async evaluator function for a user-defined AI rule. The rule's
 * prompt names what to look for; we hand it to a fast model with the memo
 * context and a strict structured-output schema.
 */
export function aiRuleEvaluator(args: {
  slug: string;
  config: AIEvaluatorConfig;
  ruleSeverity: "HARD" | "SOFT";
}): RuleEvaluator {
  return async (ctx: RuleContext) => {
    try {
      const memoCtx = renderMemoContext(ctx);
      const result = await generateObject({
        model: getOpenAI()(MODELS.fast),
        schema: AIEvalOutputSchema,
        system: SYSTEM,
        prompt: [
          `Rule to enforce: ${args.config.prompt}`,
          `(Default severity if violated: ${args.config.defaultSeverity})`,
          "",
          "Memo to evaluate:",
          memoCtx,
        ].join("\n"),
        temperature: 0.1,
      });
      if (!result.object.violated || result.object.objections.length === 0) {
        return [];
      }
      return result.object.objections.map((o): ObjectionDraft => {
        // Hard-rule objections coerce to BLOCKING when the AI hesitated.
        const severity: Severity =
          args.ruleSeverity === "HARD"
            ? o.severity === "BLOCKING" || o.severity === "MAJOR"
              ? "BLOCKING"
              : o.severity
            : o.severity;
        return {
          type: "data_contradiction",
          severity,
          anchorSection: o.anchorSection as AnchorSection,
          anchorExcerpt: o.evidenceQuote,
          title: o.title,
          body: o.body,
          recommendation: null,
          evidence: o.evidenceQuote
            ? [
                {
                  source: {
                    url: `custom-rule:${args.slug}`,
                    title: "Custom rule",
                    quote: o.evidenceQuote,
                  },
                  excerpt: o.evidenceQuote,
                  contradicts: null,
                },
              ]
            : [],
          ruleSlug: args.slug,
        };
      });
    } catch (err) {
      // AI rule failures are logged and skipped — a single rule's network
      // hiccup must not nuke the whole review pass.
      console.warn(
        `[critic] AI rule '${args.slug}' failed:`,
        err instanceof Error ? err.message : err,
      );
      return [];
    }
  };
}
