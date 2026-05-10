"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  addIssuerGroupMember,
  createIssuerGroup,
  deleteIssuerGroup,
  removeIssuerGroupMember,
  updateIssuerGroupMeta,
} from "@/lib/funds";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  notes: z.string().max(2000).optional(),
  tickers: z.string().max(2000).optional(),
});

export async function createGroupAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    notes: formData.get("notes") || undefined,
    tickers: formData.get("tickers") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const tickers = (parsed.data.tickers ?? "")
    .split(/[\s,]+/)
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const group = await createIssuerGroup({
    name: parsed.data.name,
    notes: parsed.data.notes,
    tickers,
    createdByUserId: session.user.id,
  });

  revalidatePath("/groups");
  redirect(`/groups/${group.id}`);
}

export async function updateGroupAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const name = String(formData.get("name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (name.length < 2) throw new Error("Name is too short");

  await updateIssuerGroupMeta(id, { name, notes: notes || undefined });
  revalidatePath(`/groups/${id}`);
  revalidatePath("/groups");
}

export async function addMemberAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const groupId = String(formData.get("groupId") ?? "");
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase();
  if (!groupId || !ticker) throw new Error("Missing groupId or ticker");
  await addIssuerGroupMember(groupId, ticker);
  revalidatePath(`/groups/${groupId}`);
}

export async function removeMemberAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const memberId = String(formData.get("memberId") ?? "");
  const groupId = String(formData.get("groupId") ?? "");
  if (!memberId) throw new Error("Missing memberId");
  await removeIssuerGroupMember(memberId);
  if (groupId) revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroupAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await deleteIssuerGroup(id);
  revalidatePath("/groups");
  redirect("/groups");
}
