import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "./db";
import {
  auditEntries,
  memos,
  memoRuns,
  users,
  type NewMemo,
} from "./db/schema";
import type {
  FundSynthesizedMemo,
  SynthesizedMemo,
} from "./agents/types";

export async function createMemo(input: NewMemo) {
  const [row] = await db.insert(memos).values(input).returning();
  return row;
}

export async function listMemosForUser(userId: string) {
  return db
    .select()
    .from(memos)
    .where(eq(memos.createdByUserId, userId))
    .orderBy(desc(memos.updatedAt));
}

export async function listAllMemos() {
  return db.select().from(memos).orderBy(desc(memos.updatedAt));
}

/**
 * CIO view: drafts are private to the Fund Manager. CIOs see everything that
 * has at least been submitted once — in_review, approved, or rejected.
 */
export async function listMemosForCio() {
  return db
    .select()
    .from(memos)
    .where(ne(memos.status, "draft"))
    .orderBy(desc(memos.updatedAt));
}

/**
 * Returns up to `limit` memos owned by the seeded "demo" user — surfaced
 * in the empty state on /memos so a freshly signed-up FM has something
 * to react to before authoring their first thesis. Excludes drafts so
 * examples always have a completed stress-test / review attached.
 *
 * Returns an empty array if the seed user has been renamed or removed.
 */
export async function listExampleMemos(limit = 3) {
  const seedEmail = process.env.SEED_FM_EMAIL ?? "demo@devilsadvocate.local";
  const seedUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, seedEmail))
    .limit(1);
  if (seedUser.length === 0) return [];
  return db
    .select()
    .from(memos)
    .where(
      and(
        eq(memos.createdByUserId, seedUser[0].id),
        ne(memos.status, "draft"),
      ),
    )
    .orderBy(desc(memos.updatedAt))
    .limit(limit);
}

export async function listMemosForReview() {
  return db
    .select()
    .from(memos)
    .where(eq(memos.status, "in_review"))
    .orderBy(desc(memos.updatedAt));
}

export async function getMemoById(id: string, opts?: { ownerId?: string }) {
  const where = opts?.ownerId
    ? and(eq(memos.id, id), eq(memos.createdByUserId, opts.ownerId))
    : eq(memos.id, id);
  const rows = await db.select().from(memos).where(where).limit(1);
  return rows[0] ?? null;
}

export async function getReviewerInfo(reviewerId: string | null) {
  if (!reviewerId) return null;
  const rows = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, reviewerId))
    .limit(1);
  return rows[0] ?? null;
}

export async function listRunsForMemo(memoId: string) {
  return db
    .select()
    .from(memoRuns)
    .where(eq(memoRuns.memoId, memoId))
    .orderBy(desc(memoRuns.startedAt));
}

export async function getRunById(runId: string) {
  const rows = await db
    .select()
    .from(memoRuns)
    .where(eq(memoRuns.id, runId))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Update the editable fields on a memo. Only allowed when status is "draft"
 * or "rejected" — everything else is locked.
 */
export async function updateMemoFields(
  memoId: string,
  ownerId: string,
  patch: {
    thesis?: string;
    areasOfConcern?: string | null;
    privatePeers?: string | null;
  },
) {
  const [updated] = await db
    .update(memos)
    .set({
      ...(patch.thesis !== undefined ? { thesis: patch.thesis } : {}),
      ...(patch.areasOfConcern !== undefined
        ? { areasOfConcern: patch.areasOfConcern }
        : {}),
      ...(patch.privatePeers !== undefined
        ? { privatePeers: patch.privatePeers }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(memos.id, memoId), eq(memos.createdByUserId, ownerId)))
    .returning();
  return updated ?? null;
}

export async function listAuditEntriesForRun(runId: string) {
  return db
    .select()
    .from(auditEntries)
    .where(eq(auditEntries.memoRunId, runId))
    .orderBy(auditEntries.createdAt);
}

export async function getLatestCompletedRun(memoId: string) {
  const rows = await db
    .select()
    .from(memoRuns)
    .where(and(eq(memoRuns.memoId, memoId), eq(memoRuns.status, "completed")))
    .orderBy(desc(memoRuns.finishedAt))
    .limit(1);
  return rows[0] ?? null;
}

export function parseSynthesizedMemo(json: string | null): SynthesizedMemo | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as SynthesizedMemo;
  } catch {
    return null;
  }
}

export function parseFundSynthesizedMemo(
  json: string | null,
): FundSynthesizedMemo | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as FundSynthesizedMemo;
  } catch {
    return null;
  }
}

export async function submitMemoForReview(memoId: string, ownerId: string) {
  const [updated] = await db
    .update(memos)
    .set({ status: "in_review", updatedAt: new Date() })
    .where(and(eq(memos.id, memoId), eq(memos.createdByUserId, ownerId)))
    .returning();
  return updated ?? null;
}

/**
 * Memo statuses an FM is allowed to edit. "changes_requested" is editable so
 * the FM can address the Critic's objections; submitting again kicks off a
 * new review pass.
 */
export const EDITABLE_STATUSES = new Set([
  "draft",
  "changes_requested",
  "rejected",
] as const);

export const SUBMITTABLE_STATUSES = new Set([
  "draft",
  "changes_requested",
  "rejected",
] as const);

export async function decideMemo(
  memoId: string,
  reviewerId: string,
  decision: "approved" | "rejected",
  comment: string,
) {
  const [updated] = await db
    .update(memos)
    .set({
      status: decision,
      reviewedByUserId: reviewerId,
      reviewComment: comment,
      updatedAt: new Date(),
    })
    .where(eq(memos.id, memoId))
    .returning();
  return updated ?? null;
}
