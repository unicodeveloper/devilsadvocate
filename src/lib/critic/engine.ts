import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import {
  memos,
  memoRuns,
  reviews,
  objections,
  type Memo,
  type Review,
} from "../db/schema";
import { getLatestHouseViewVersion, readHouseView } from "../house-view";
import { parseFundSynthesizedMemo, parseSynthesizedMemo } from "../memos";
import type {
  AgentOutputs,
  Decision,
  ObjectionDraft,
  RuleDefinition,
  Verdict,
} from "./types";
import { ENGINE_VERSION } from "./types";
import { loadEnabledRules } from "./rules";

const ENGINE_MODEL = "devils-advocate/orchestrator";
const PROMPT_HASH = createHash("sha256")
  .update(`engine:${ENGINE_VERSION}:builtin-v1`)
  .digest("hex")
  .slice(0, 16);

/**
 * Compute a verdict from a set of objections. Mirrors the spec:
 * - Any BLOCKING objection from a HARD rule  ⇒ REJECTED
 * - Any BLOCKING objection from a SOFT rule  ⇒ CHANGES_REQUESTED
 * - Any MAJOR objection                       ⇒ CHANGES_REQUESTED
 * - Only MINOR / INFO                         ⇒ APPROVED
 */
function computeDecision(
  objs: ObjectionDraft[],
  rules: Map<string, RuleDefinition>,
): { decision: Decision; confidence: number } {
  let hardBlocking = 0;
  let softBlocking = 0;
  let major = 0;
  let minor = 0;

  for (const o of objs) {
    const rule = rules.get(o.ruleSlug);
    const isHard = rule?.severity === "HARD";
    if (o.severity === "BLOCKING") {
      if (isHard) hardBlocking++;
      else softBlocking++;
    } else if (o.severity === "MAJOR") major++;
    else if (o.severity === "MINOR") minor++;
  }

  if (hardBlocking > 0) {
    return { decision: "rejected", confidence: 0.99 };
  }
  if (softBlocking > 0 || major > 0) {
    // Confidence in "changes requested" scales with how many MAJOR issues we found
    const confidence = Math.min(0.95, 0.7 + Math.min(major, 5) * 0.05);
    return { decision: "changes_requested", confidence };
  }
  // APPROVED — confidence drops slightly with minor issues outstanding
  const confidence = Math.max(0.85, 0.97 - minor * 0.02);
  return { decision: "approved", confidence };
}

function buildSummary(
  decision: Decision,
  objs: ObjectionDraft[],
  memo: Memo,
): string {
  const blocking = objs.filter((o) => o.severity === "BLOCKING").length;
  const major = objs.filter((o) => o.severity === "MAJOR").length;
  const minor = objs.filter((o) => o.severity === "MINOR").length;
  const subject =
    memo.entityType === "fund" ? "the fund" : memo.stockTicker ?? "the thesis";

  if (decision === "rejected") {
    return `${subject} cannot ship: ${blocking} House View violation${blocking === 1 ? "" : "s"} block this thesis. Revise the underlying premise before resubmitting.`;
  }
  if (decision === "changes_requested") {
    const parts: string[] = [];
    if (blocking) parts.push(`${blocking} blocking issue${blocking === 1 ? "" : "s"}`);
    if (major) parts.push(`${major} major risk${major === 1 ? "" : "s"}`);
    if (minor) parts.push(`${minor} minor note${minor === 1 ? "" : "s"}`);
    return `${parts.join(", ")} found on ${subject}. Address each inline or dispute with reasoning, then resubmit.`;
  }
  return minor
    ? `${subject} clears review with ${minor} advisory note${minor === 1 ? "" : "s"} for IC Q&A.`
    : `${subject} clears review with no outstanding issues.`;
}

/**
 * Pull the latest *completed* memoRun for a memo and parse its synthesized
 * output back into typed agent outputs. The Critic engine reuses these — the
 * stress-test pipeline already produced everything we need.
 */
async function loadAgentOutputs(
  memo: Memo,
): Promise<{ outputs: AgentOutputs; memoRunId: string } | null> {
  const runs = await db
    .select()
    .from(memoRuns)
    .where(eq(memoRuns.memoId, memo.id))
    .orderBy(memoRuns.startedAt);
  const completed = runs.filter((r) => r.status === "completed").pop();
  if (!completed) return null;
  if (memo.entityType === "fund") {
    const synth = parseFundSynthesizedMemo(completed.synthesizedMemoJson);
    if (!synth) return null;
    return {
      outputs: {
        kind: "fund",
        synth,
        // Synthesized memo carries the load-bearing fields we need; the full
        // bull/bear/HV outputs would be richer but require digging through
        // audit_entries. v1 reuses the synthesizer's already-merged view.
        bull: { thesisRestated: synth.setup.summary, strategyAlignment: "", topPickRationales: [], portfolioStrengths: [] },
        bear: {
          contrarianSummary: synth.stressTest.summary,
          concentrationRisks: [],
          weakHoldingsFlags: synth.stressTest.findings,
          macroOrSectorRisks: [],
          blindSpots: synth.stressTest.blindSpots,
        },
        houseView: {
          overallAlignment:
            synth.houseViewOverlay.ruleVerdicts.some((v) => v.verdict === "fail")
              ? "violates"
              : synth.houseViewOverlay.ruleVerdicts.some((v) => v.verdict === "mixed")
                ? "partially_aligned"
                : "aligned",
          ruleEvaluations: synth.houseViewOverlay.ruleVerdicts,
          totalViolationWeightPct: synth.houseViewOverlay.ruleVerdicts.reduce(
            (sum, v) => sum + (v.verdict !== "pass" ? v.weightedViolationPct ?? 0 : 0),
            0,
          ),
          divergence: null,
        },
      },
      memoRunId: completed.id,
    };
  }
  const synth = parseSynthesizedMemo(completed.synthesizedMemoJson);
  if (!synth) return null;
  return {
    outputs: {
      kind: "stock",
      synth,
      bull: { thesisRestated: synth.setup.summary, supportingClaims: [] },
      bear: {
        contrarianSummary: synth.stressTest.summary,
        risks: synth.stressTest.findings,
        blindSpots: synth.stressTest.blindSpots,
      },
      houseView: {
        overallAlignment:
          synth.houseViewOverlay.ruleVerdicts.some((v) => v.verdict === "fail")
            ? "violates"
            : "aligned",
        ruleEvaluations: synth.houseViewOverlay.ruleVerdicts,
        divergence: null,
      },
    },
    memoRunId: completed.id,
  };
}

export type RunReviewResult =
  | { ok: true; review: Review; verdict: Verdict }
  | { ok: false; error: string };

/**
 * Run the Critic engine over a memo and persist the results.
 *
 * Two-stage gate:
 *   Stage 1 (HARD) — rejection-eligible rules. If any fire BLOCKING, we stop.
 *   Stage 2 (SOFT) — advisory rules. Their objections feed into the verdict.
 *
 * Both stages run code evaluators only for v1. AI evaluators come later.
 */
export async function runReview(memoId: string): Promise<RunReviewResult> {
  const [memoRow] = await db.select().from(memos).where(eq(memos.id, memoId)).limit(1);
  if (!memoRow) return { ok: false, error: "Memo not found" };

  const agentLoad = await loadAgentOutputs(memoRow);
  if (!agentLoad) {
    return {
      ok: false,
      error: "No completed stress-test on this memo. Run stress-test first.",
    };
  }

  // Reviews are evaluated against the memo author's House View — that's
  // who owns the mandate this thesis is being measured against.
  const houseViewMarkdown = await readHouseView(memoRow.createdByUserId);
  const hvVersion = await getLatestHouseViewVersion(memoRow.createdByUserId);
  // Run the memo author's ruleset: global built-ins (with their toggle
  // overrides) + their own custom rules. Another FM's customs never run.
  const ruleset = await loadEnabledRules(
    memoRow.entityType as "stock" | "fund",
    memoRow.createdByUserId,
  );

  // Insert the running review record
  const [reviewRow] = await db
    .insert(reviews)
    .values({
      memoId: memoRow.id,
      memoVersion: 1,
      status: "running",
      engineVersion: ENGINE_VERSION,
      engineModel: ENGINE_MODEL,
      promptHash: PROMPT_HASH,
      rulesetHash: ruleset.hash,
      houseViewVersionId: hvVersion?.id,
      memoRunId: agentLoad.memoRunId,
    })
    .returning();

  try {
    const ruleMap = new Map(ruleset.rules.map((r) => [r.slug, r]));
    const ctx = {
      memo: memoRow,
      outputs: agentLoad.outputs,
      houseViewMarkdown,
    };

    // Stage 1 — HARD rules, run in parallel. Their objections gate rejection.
    const hardRules = ruleset.rules.filter((r) => r.severity === "HARD");
    const stage1Results = await Promise.all(
      hardRules.map(async (r) => Promise.resolve(r.evaluator(ctx))),
    );
    const stage1Drafts: ObjectionDraft[] = stage1Results.flat();
    const hardBlocking = stage1Drafts.some((o) => o.severity === "BLOCKING");

    // Stage 2 — SOFT rules. Skip when Stage 1 already rejected to save LLM
    // compute on AI-backed soft rules; the FM still gets the rejection
    // explanation and can address it before resubmit.
    const softRules = hardBlocking
      ? []
      : ruleset.rules.filter((r) => r.severity === "SOFT");
    const stage2Results = await Promise.all(
      softRules.map(async (r) => Promise.resolve(r.evaluator(ctx))),
    );
    const stage2Drafts: ObjectionDraft[] = stage2Results.flat();

    const allDrafts = [...stage1Drafts, ...stage2Drafts];
    const { decision, confidence } = computeDecision(allDrafts, ruleMap);
    const passedRuleSlugs = ruleset.rules
      .filter((r) => !allDrafts.some((o) => o.ruleSlug === r.slug))
      .map((r) => r.slug);
    const summary = buildSummary(decision, allDrafts, memoRow);

    // Persist objections
    if (allDrafts.length > 0) {
      await db.insert(objections).values(
        allDrafts.map((d) => ({
          reviewId: reviewRow.id,
          ruleId: null, // future: resolve criticRules.id by slug
          type: d.type,
          severity: d.severity,
          anchorSection: d.anchorSection,
          anchorExcerpt: d.anchorExcerpt,
          title: d.title,
          body: d.body,
          recommendation: d.recommendation,
          evidenceJson: JSON.stringify(d.evidence),
        })),
      );
    }

    // Finalize review record
    const [updatedReview] = await db
      .update(reviews)
      .set({
        status: "completed",
        decision,
        confidence: Math.round(confidence * 100),
        summary,
        finishedAt: new Date(),
      })
      .where(eq(reviews.id, reviewRow.id))
      .returning();

    // Update memo status
    const memoStatus =
      decision === "approved"
        ? "approved"
        : decision === "rejected"
          ? "rejected"
          : "changes_requested";
    await db
      .update(memos)
      .set({ status: memoStatus, updatedAt: new Date() })
      .where(eq(memos.id, memoRow.id));

    return {
      ok: true,
      review: updatedReview,
      verdict: { decision, confidence, summary, objections: allDrafts, passedRuleSlugs },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(reviews)
      .set({ status: "failed", errorMessage: message, finishedAt: new Date() })
      .where(eq(reviews.id, reviewRow.id));
    return { ok: false, error: message };
  }
}
