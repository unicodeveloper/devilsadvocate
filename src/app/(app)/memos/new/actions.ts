"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createMemo } from "@/lib/memos";
import { getFundById } from "@/lib/funds";

const stockSchema = z.object({
  stockTicker: z.string().min(1).max(20),
  stockName: z.string().min(1).max(200),
  stockExchange: z.string().max(50).optional(),
  stockSector: z.string().max(120).optional(),
  thesis: z.string().min(10, "Thesis is too short").max(8000),
  areasOfConcern: z.string().max(4000).optional(),
  privatePeers: z.string().max(800).optional(),
});

const fundSchema = z.object({
  fundId: z.string().min(1, "Pick a fund"),
  thesis: z.string().min(10, "Thesis is too short").max(8000),
  areasOfConcern: z.string().max(4000).optional(),
});

export async function createMemoAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (session.user.role !== "fund_manager") {
    throw new Error("Only Fund Managers can create memos");
  }

  const parsed = stockSchema.safeParse({
    stockTicker: formData.get("stockTicker"),
    stockName: formData.get("stockName"),
    stockExchange: formData.get("stockExchange") || undefined,
    stockSector: formData.get("stockSector") || undefined,
    thesis: formData.get("thesis"),
    areasOfConcern: formData.get("areasOfConcern") || undefined,
    privatePeers: formData.get("privatePeers") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const memo = await createMemo({
    ...parsed.data,
    entityType: "stock",
    createdByUserId: session.user.id,
    status: "draft",
  });

  revalidatePath("/memos");
  redirect(`/memos/${memo.id}`);
}

export async function createFundMemoAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (session.user.role !== "fund_manager") {
    throw new Error("Only Fund Managers can create memos");
  }

  const parsed = fundSchema.safeParse({
    fundId: formData.get("fundId"),
    thesis: formData.get("thesis"),
    areasOfConcern: formData.get("areasOfConcern") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const fund = await getFundById(parsed.data.fundId);
  if (!fund) throw new Error("Fund not found");

  const memo = await createMemo({
    entityType: "fund",
    fundId: fund.id,
    thesis: parsed.data.thesis,
    areasOfConcern: parsed.data.areasOfConcern,
    createdByUserId: session.user.id,
    status: "draft",
  });

  revalidatePath("/memos");
  redirect(`/memos/${memo.id}`);
}
