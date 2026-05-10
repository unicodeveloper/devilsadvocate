import { inArray, eq } from "drizzle-orm";
import { db } from "./index";
import {
  memos,
  memoRuns,
  reviews,
  objections,
  objectionThreads,
  funds,
} from "./schema";
import demoData from "./seed-data/demo-memos.json";

/**
 * Schema of one entry in demo-memos.json. Each entry contains a memo row
 * plus its latest run / review / objections / threads. References to fund
 * IDs / house-view versions / rule IDs / user IDs are remapped at insert
 * time since those differ per environment.
 */
type Demo = {
  memo: {
    id: string;
    entity_type: "stock" | "fund";
    stock_ticker: string | null;
    stock_name: string | null;
    stock_exchange: string | null;
    stock_sector: string | null;
    fund_id: string | null;
    thesis: string;
    areas_of_concern: string | null;
    private_peers: string | null;
    status: "draft" | "in_review" | "changes_requested" | "approved" | "rejected";
    reviewed_by_user_id: string | null;
    review_comment: string | null;
    created_at: number;
    updated_at: number;
  };
  fundName: string | null;
  latestRun: {
    id: string;
    memo_id: string;
    status: "running" | "completed" | "failed";
    areas_of_concern_snapshot: string | null;
    thesis_snapshot: string;
    synthesized_memo_json: string | null;
    error_message: string | null;
    started_at: number;
    finished_at: number | null;
  } | null;
  latestReview: {
    id: string;
    memo_id: string;
    memo_version: number;
    status: "running" | "completed" | "failed";
    decision: "approved" | "changes_requested" | "rejected" | null;
    confidence: number | null;
    summary: string | null;
    engine_version: string;
    engine_model: string;
    prompt_hash: string;
    ruleset_hash: string;
    error_message: string | null;
    started_at: number;
    finished_at: number | null;
  } | null;
  objections: Array<{
    id: string;
    review_id: string;
    type:
      | "house_view_violation"
      | "data_contradiction"
      | "unsupported_claim"
      | "consensus_divergence"
      | "private_peer_threat"
      | "macro_risk"
      | "thesis_incoherence"
      | "blind_spot";
    severity: "BLOCKING" | "MAJOR" | "MINOR" | "INFO";
    anchor_section: string;
    anchor_excerpt: string | null;
    title: string;
    body: string;
    recommendation: string | null;
    evidence_json: string;
    status: "open" | "resolved" | "disputed" | "wontfix";
    created_at: number;
    updated_at: number;
  }>;
  threads: Array<{
    id: string;
    objection_id: string;
    author_kind: "engine" | "fund_manager";
    author_user_id: string | null;
    kind: "dispute" | "reassertion" | "resolution_note" | "wontfix_note";
    body: string;
    created_at: number;
  }>;
};

const DEMOS = demoData as Demo[];

/**
 * Inserts the demo memos + their stress-test runs, reviews, objections, and
 * threads. Idempotent — if any of the demo memo IDs already exist, the whole
 * thing is skipped. Fund-memo references are resolved by fund name; if the
 * referenced fund isn't seeded, that memo is skipped with a warning.
 */
export async function seedDemoMemosIfEmpty(
  seedUserId: string,
): Promise<"seeded" | "skipped"> {
  const demoIds = DEMOS.map((d) => d.memo.id);
  const existing = await db
    .select({ id: memos.id })
    .from(memos)
    .where(inArray(memos.id, demoIds))
    .all();
  if (existing.length > 0) return "skipped";

  const fundRows = await db.select({ id: funds.id, name: funds.name }).from(funds);
  const fundIdByName = new Map(fundRows.map((f) => [f.name, f.id]));

  for (const demo of DEMOS) {
    const m = demo.memo;

    let fundId: string | null = null;
    if (m.entity_type === "fund") {
      if (!demo.fundName) {
        console.warn(`skip demo memo ${m.id} (fund memo without fund name)`);
        continue;
      }
      fundId = fundIdByName.get(demo.fundName) ?? null;
      if (!fundId) {
        console.warn(
          `skip demo memo ${m.id} (fund "${demo.fundName}" not seeded)`,
        );
        continue;
      }
    }

    await db.insert(memos).values({
      id: m.id,
      entityType: m.entity_type,
      stockTicker: m.stock_ticker,
      stockName: m.stock_name,
      stockExchange: m.stock_exchange,
      stockSector: m.stock_sector,
      fundId,
      thesis: m.thesis,
      areasOfConcern: m.areas_of_concern,
      privatePeers: m.private_peers,
      status: m.status,
      createdByUserId: seedUserId,
      reviewedByUserId: m.reviewed_by_user_id ? seedUserId : null,
      reviewComment: m.review_comment,
      createdAt: new Date(m.created_at),
      updatedAt: new Date(m.updated_at),
    });

    if (demo.latestRun) {
      const r = demo.latestRun;
      await db.insert(memoRuns).values({
        id: r.id,
        memoId: r.memo_id,
        status: r.status,
        houseViewVersionId: null, // version IDs differ per env
        areasOfConcernSnapshot: r.areas_of_concern_snapshot,
        thesisSnapshot: r.thesis_snapshot,
        synthesizedMemoJson: r.synthesized_memo_json,
        errorMessage: r.error_message,
        startedAt: new Date(r.started_at),
        finishedAt: r.finished_at ? new Date(r.finished_at) : null,
      });
    }

    if (demo.latestReview) {
      const r = demo.latestReview;
      await db.insert(reviews).values({
        id: r.id,
        memoId: r.memo_id,
        memoVersion: r.memo_version,
        status: r.status,
        decision: r.decision,
        confidence: r.confidence,
        summary: r.summary,
        engineVersion: r.engine_version,
        engineModel: r.engine_model,
        promptHash: r.prompt_hash,
        rulesetHash: r.ruleset_hash,
        houseViewVersionId: null,
        memoRunId: demo.latestRun?.id ?? null,
        errorMessage: r.error_message,
        startedAt: new Date(r.started_at),
        finishedAt: r.finished_at ? new Date(r.finished_at) : null,
      });
    }

    for (const o of demo.objections) {
      await db.insert(objections).values({
        id: o.id,
        reviewId: o.review_id,
        ruleId: null, // rule IDs differ per env
        type: o.type,
        severity: o.severity,
        anchorSection: o.anchor_section,
        anchorExcerpt: o.anchor_excerpt,
        title: o.title,
        body: o.body,
        recommendation: o.recommendation,
        evidenceJson: o.evidence_json,
        status: o.status,
        createdAt: new Date(o.created_at),
        updatedAt: new Date(o.updated_at),
      });
    }

    for (const t of demo.threads) {
      await db.insert(objectionThreads).values({
        id: t.id,
        objectionId: t.objection_id,
        authorKind: t.author_kind,
        // If the original thread had an author, attribute to the seed user.
        // Engine-authored threads stay null.
        authorUserId: t.author_user_id ? seedUserId : null,
        kind: t.kind,
        body: t.body,
        createdAt: new Date(t.created_at),
      });
    }
  }

  return "seeded";
}

// Re-export so callers can introspect how many demos are bundled.
export const DEMO_MEMO_COUNT = DEMOS.length;
