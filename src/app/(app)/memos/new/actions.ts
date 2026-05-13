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

const privateCompanySchema = z.object({
  privateCompanyName: z.string().min(1, "Company name is required").max(200),
  privateCompanyUrl: z
    .string()
    .url("Website must be a valid URL")
    .max(500),
  // JSON array of founder names, validated downstream.
  privateCompanyFounders: z.string().min(2, "At least one founder is required"),
  privateCompanyRoundStage: z.enum(["seed", "series_a", "series_b"]),
  privateCompanySector: z.string().max(120).optional(),
  privateCompanyGeo: z.string().max(120).optional(),
  privateCompanyCheckSizeUsd: z
    .string()
    .regex(/^\d+$/, "Check size must be a whole number")
    .optional(),
  privateCompanyPostMoneyUsd: z
    .string()
    .regex(/^\d+$/, "Post-money must be a whole number")
    .optional(),
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

export async function createPrivateCompanyMemoAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (session.user.role !== "fund_manager") {
    throw new Error("Only Fund Managers can create memos");
  }

  const parsed = privateCompanySchema.safeParse({
    privateCompanyName: formData.get("privateCompanyName"),
    privateCompanyUrl: formData.get("privateCompanyUrl"),
    privateCompanyFounders: formData.get("privateCompanyFounders"),
    privateCompanyRoundStage: formData.get("privateCompanyRoundStage"),
    privateCompanySector: formData.get("privateCompanySector") || undefined,
    privateCompanyGeo: formData.get("privateCompanyGeo") || undefined,
    privateCompanyCheckSizeUsd:
      formData.get("privateCompanyCheckSizeUsd") || undefined,
    privateCompanyPostMoneyUsd:
      formData.get("privateCompanyPostMoneyUsd") || undefined,
    thesis: formData.get("thesis"),
    areasOfConcern: formData.get("areasOfConcern") || undefined,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  // Founders arrive as a JSON-stringified array; validate that it's a
  // non-empty array of short strings before persisting.
  let founders: string[];
  try {
    const raw = JSON.parse(parsed.data.privateCompanyFounders);
    if (!Array.isArray(raw)) throw new Error("not an array");
    founders = raw
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 120)
      .slice(0, 6);
  } catch {
    throw new Error("Founders must be a JSON array of names");
  }
  if (founders.length === 0) {
    throw new Error("At least one founder name is required");
  }

  const memo = await createMemo({
    entityType: "private_company",
    privateCompanyName: parsed.data.privateCompanyName,
    privateCompanyUrl: parsed.data.privateCompanyUrl,
    privateCompanyFoundersJson: JSON.stringify(founders),
    privateCompanyRoundStage: parsed.data.privateCompanyRoundStage,
    privateCompanySector: parsed.data.privateCompanySector ?? null,
    privateCompanyGeo: parsed.data.privateCompanyGeo ?? null,
    privateCompanyCheckSizeUsd: parsed.data.privateCompanyCheckSizeUsd
      ? Number(parsed.data.privateCompanyCheckSizeUsd)
      : null,
    privateCompanyPostMoneyUsd: parsed.data.privateCompanyPostMoneyUsd
      ? Number(parsed.data.privateCompanyPostMoneyUsd)
      : null,
    thesis: parsed.data.thesis,
    areasOfConcern: parsed.data.areasOfConcern,
    createdByUserId: session.user.id,
    status: "draft",
  });

  revalidatePath("/memos");
  redirect(`/memos/${memo.id}`);
}
