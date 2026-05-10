"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { writeHouseView } from "@/lib/house-view";

export async function saveHouseViewAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const content = String(formData.get("content") ?? "");
  if (!content.trim()) throw new Error("House View cannot be empty");

  await writeHouseView(content, session.user.id);
  revalidatePath("/house-view");
}
