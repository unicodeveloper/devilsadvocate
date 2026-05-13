"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  writeHouseView,
  writePrivateMandate,
  type PrivateMandateFields,
} from "@/lib/house-view";

export async function saveHouseViewAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const content = String(formData.get("content") ?? "");
  if (!content.trim()) throw new Error("House View cannot be empty");

  await writeHouseView(content, session.user.id);
  revalidatePath("/house-view");
}

const mandateSchema = z.object({
  checkSizeMinUsd: z.number().int().nonnegative().nullable(),
  checkSizeMaxUsd: z.number().int().nonnegative().nullable(),
  stageAllowlist: z.array(z.enum(["seed", "series_a", "series_b"])).nullable(),
  sectorAllowlist: z.array(z.string().min(1).max(80)).max(40).nullable(),
  sectorBlocklist: z.array(z.string().min(1).max(80)).max(40).nullable(),
  geoAllowlist: z.array(z.string().min(1).max(80)).max(40).nullable(),
});

export async function savePrivateMandateAction(payload: PrivateMandateFields) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const parsed = mandateSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  if (
    parsed.data.checkSizeMinUsd !== null &&
    parsed.data.checkSizeMaxUsd !== null &&
    parsed.data.checkSizeMinUsd > parsed.data.checkSizeMaxUsd
  ) {
    throw new Error("Check-size minimum cannot exceed maximum");
  }

  await writePrivateMandate(parsed.data, session.user.id);
  revalidatePath("/house-view");
}
