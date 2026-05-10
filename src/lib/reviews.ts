import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import {
  objectionThreads,
  objections,
  reviews,
  type ObjectionThread,
  type Review,
} from "./db/schema";
import type { Evidence } from "./critic/types";
import type { LoadedObjection, LoadedReview } from "./reviews-shared";

export type { LoadedObjection, LoadedReview } from "./reviews-shared";
export { canResubmit, summarizeObjections } from "./reviews-shared";

/**
 * Latest completed review for a memo. Returns null when the memo has never
 * been submitted, or when the most recent review is still running/failed.
 */
export async function getLatestReview(memoId: string): Promise<Review | null> {
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.memoId, memoId))
    .orderBy(desc(reviews.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestCompletedReview(memoId: string): Promise<Review | null> {
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.memoId, memoId), eq(reviews.status, "completed")))
    .orderBy(desc(reviews.finishedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listReviewsForMemo(memoId: string): Promise<Review[]> {
  return db
    .select()
    .from(reviews)
    .where(eq(reviews.memoId, memoId))
    .orderBy(desc(reviews.startedAt));
}

export async function loadReviewWithObjections(
  reviewId: string,
): Promise<LoadedReview | null> {
  const [review] = await db.select().from(reviews).where(eq(reviews.id, reviewId)).limit(1);
  if (!review) return null;
  const objs = await db
    .select()
    .from(objections)
    .where(eq(objections.reviewId, reviewId))
    .orderBy(asc(objections.createdAt));
  const objIds = objs.map((o) => o.id);
  const threadRows = objIds.length
    ? await db
        .select()
        .from(objectionThreads)
        .orderBy(asc(objectionThreads.createdAt))
    : [];
  const threadsByObjection = new Map<string, ObjectionThread[]>();
  for (const t of threadRows) {
    const list = threadsByObjection.get(t.objectionId) ?? [];
    list.push(t);
    threadsByObjection.set(t.objectionId, list);
  }
  const loaded: LoadedObjection[] = objs.map((o) => ({
    ...o,
    evidence: parseEvidence(o.evidenceJson),
    threads: threadsByObjection.get(o.id) ?? [],
  }));
  return { ...review, objections: loaded };
}

function parseEvidence(json: string): Evidence[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Evidence[]) : [];
  } catch {
    return [];
  }
}
