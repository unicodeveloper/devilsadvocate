"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createFund,
  deleteFund,
  parseHoldingsCsv,
  replaceFundHoldings,
} from "@/lib/funds";

const fundInputSchema = z.object({
  name: z.string().min(2).max(200),
  type: z.enum(["mf", "pms", "aif"]),
  schemeCode: z.string().max(50).optional(),
  fundManager: z.string().max(200).optional(),
  currency: z.enum(["USD", "EUR", "GBP", "INR", "JPY"]).default("USD"),
  aumNative: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

export async function createFundAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const parsed = fundInputSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    schemeCode: formData.get("schemeCode") || undefined,
    fundManager: formData.get("fundManager") || undefined,
    currency: formData.get("currency") || undefined,
    aumNative: formData.get("aumNative") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const csvFile = formData.get("holdingsCsv");
  let parseResult: ReturnType<typeof parseHoldingsCsv> | null = null;
  let csvText = "";
  if (csvFile instanceof File && csvFile.size > 0) {
    csvText = await csvFile.text();
    parseResult = parseHoldingsCsv(csvText);
  }

  const fund = await createFund({
    ...parsed.data,
    createdByUserId: session.user.id,
  });

  if (parseResult) {
    await replaceFundHoldings(fund.id, parseResult.rows);
  }

  revalidatePath("/funds");
  redirect(`/funds/${fund.id}`);
}

export async function uploadHoldingsAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const fundId = String(formData.get("fundId") ?? "");
  if (!fundId) throw new Error("Missing fundId");

  const csvFile = formData.get("holdingsCsv");
  if (!(csvFile instanceof File) || csvFile.size === 0) {
    throw new Error("No CSV uploaded");
  }
  const csvText = await csvFile.text();
  const parsed = parseHoldingsCsv(csvText);

  await replaceFundHoldings(fundId, parsed.rows);

  revalidatePath(`/funds/${fundId}`);
  return parsed.warnings;
}

export async function deleteFundAction(fundId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  await deleteFund(fundId);
  revalidatePath("/funds");
  redirect("/funds");
}
