"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memos, objectionThreads, objections, reviews } from "@/lib/db/schema";
import { runReview } from "@/lib/critic/engine";
import {
  EDITABLE_STATUSES,
  SUBMITTABLE_STATUSES,
  getLatestCompletedRun,
  getMemoById,
  submitMemoForReview,
  updateMemoFields,
} from "@/lib/memos";

/**
 * Submit a memo for review. Runs the Critic engine inline — this is fast
 * because it post-processes the existing stress-test outputs rather than
 * making fresh LLM calls. The verdict drives memo.status.
 */
export async function submitForReviewAction(memoId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const memo = await getMemoById(memoId, { ownerId: session.user.id });
  if (!memo) throw new Error("Memo not found");
  if (!SUBMITTABLE_STATUSES.has(memo.status as never)) {
    throw new Error(`Cannot submit a memo in status "${memo.status}"`);
  }

  const run = await getLatestCompletedRun(memoId);
  if (!run) {
    throw new Error("Run a stress-test first — the Critic engine reuses its outputs.");
  }

  // Mark memo as in_review for the duration of the engine run; runReview
  // updates the final status (approved / changes_requested / rejected) once
  // it persists the verdict.
  await submitMemoForReview(memoId, session.user.id);
  revalidatePath(`/memos/${memoId}`);

  const result = await runReview(memoId);
  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  revalidatePath("/review");

  if (!result.ok) {
    // Engine failed — leave the memo in_review so the FM can retry. UI shows
    // the error from the latest review row.
    throw new Error(result.error);
  }
}

const updateDraftSchema = z.object({
  thesis: z.string().min(10, "Thesis is too short").max(8000),
  areasOfConcern: z.string().max(4000).optional(),
  privatePeers: z.string().max(800).optional(),
});

export async function updateDraftAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const memoId = String(formData.get("memoId") ?? "");
  if (!memoId) throw new Error("Missing memoId");

  const memo = await getMemoById(memoId, { ownerId: session.user.id });
  if (!memo) throw new Error("Memo not found");
  if (!EDITABLE_STATUSES.has(memo.status as never)) {
    throw new Error(
      `Cannot edit a memo in status "${memo.status}". In-review memos are locked.`,
    );
  }

  const parsed = updateDraftSchema.safeParse({
    thesis: formData.get("thesis"),
    areasOfConcern: formData.get("areasOfConcern") || undefined,
    privatePeers: formData.get("privatePeers") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  await updateMemoFields(memoId, session.user.id, {
    thesis: parsed.data.thesis,
    areasOfConcern: parsed.data.areasOfConcern ?? null,
    privatePeers: parsed.data.privatePeers ?? null,
  });

  revalidatePath(`/memos/${memoId}`);
}

// ============================================================================
// Objection lifecycle — resolve / dispute / wontfix
// ============================================================================

const objectionActionSchema = z.object({
  objectionId: z.string().min(1),
  note: z.string().max(2000).optional(),
});

async function getObjectionForOwner(
  objectionId: string,
  userId: string,
): Promise<{ objection: typeof objections.$inferSelect; memoId: string } | null> {
  const [row] = await db
    .select({
      objection: objections,
      memoId: memos.id,
      ownerId: memos.createdByUserId,
    })
    .from(objections)
    .innerJoin(reviews, eq(reviews.id, objections.reviewId))
    .innerJoin(memos, eq(memos.id, reviews.memoId))
    .where(eq(objections.id, objectionId))
    .limit(1);
  if (!row || row.ownerId !== userId) return null;
  return { objection: row.objection, memoId: row.memoId };
}

export async function resolveObjectionAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const parsed = objectionActionSchema.safeParse({
    objectionId: formData.get("objectionId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const found = await getObjectionForOwner(parsed.data.objectionId, session.user.id);
  if (!found) throw new Error("Objection not found");

  await db
    .update(objections)
    .set({ status: "resolved", updatedAt: new Date() })
    .where(eq(objections.id, parsed.data.objectionId));

  if (parsed.data.note) {
    await db.insert(objectionThreads).values({
      objectionId: parsed.data.objectionId,
      authorKind: "fund_manager",
      authorUserId: session.user.id,
      kind: "resolution_note",
      body: parsed.data.note,
    });
  }

  revalidatePath(`/memos/${found.memoId}`);
}

const disputeSchema = z.object({
  objectionId: z.string().min(1),
  body: z.string().min(10, "Add a sentence or two on why this objection doesn't hold").max(2000),
});

export async function disputeObjectionAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const parsed = disputeSchema.safeParse({
    objectionId: formData.get("objectionId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const found = await getObjectionForOwner(parsed.data.objectionId, session.user.id);
  if (!found) throw new Error("Objection not found");

  await db
    .update(objections)
    .set({ status: "disputed", updatedAt: new Date() })
    .where(eq(objections.id, parsed.data.objectionId));

  await db.insert(objectionThreads).values({
    objectionId: parsed.data.objectionId,
    authorKind: "fund_manager",
    authorUserId: session.user.id,
    kind: "dispute",
    body: parsed.data.body,
  });

  revalidatePath(`/memos/${found.memoId}`);
}

export async function wontfixObjectionAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const parsed = objectionActionSchema.safeParse({
    objectionId: formData.get("objectionId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const found = await getObjectionForOwner(parsed.data.objectionId, session.user.id);
  if (!found) throw new Error("Objection not found");

  await db
    .update(objections)
    .set({ status: "wontfix", updatedAt: new Date() })
    .where(eq(objections.id, parsed.data.objectionId));

  if (parsed.data.note) {
    await db.insert(objectionThreads).values({
      objectionId: parsed.data.objectionId,
      authorKind: "fund_manager",
      authorUserId: session.user.id,
      kind: "wontfix_note",
      body: parsed.data.note,
    });
  }

  revalidatePath(`/memos/${found.memoId}`);
}
