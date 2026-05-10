"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { criticRules } from "@/lib/db/schema";

const ruleFormSchema = z.object({
  displayName: z.string().min(3, "Name is too short").max(80, "Name is too long"),
  description: z.string().min(10, "Add a sentence on what the rule does").max(500),
  severity: z.enum(["HARD", "SOFT"]),
  scope: z.enum(["stock", "fund", "both"]),
  prompt: z
    .string()
    .min(20, "Be specific about what to look for in the memo")
    .max(2000, "Prompt is too long"),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `custom-${base || "rule"}-${suffix}`;
}

export async function createCustomRuleAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sign in to manage rules");

  const parsed = ruleFormSchema.safeParse({
    displayName: formData.get("displayName"),
    description: formData.get("description"),
    severity: formData.get("severity"),
    scope: formData.get("scope"),
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  await db.insert(criticRules).values({
    slug: slugify(parsed.data.displayName),
    displayName: parsed.data.displayName,
    description: parsed.data.description,
    severity: parsed.data.severity,
    source: "custom",
    evaluatorKind: "ai",
    evaluatorConfig: JSON.stringify({
      prompt: parsed.data.prompt,
      defaultSeverity: parsed.data.severity === "HARD" ? "BLOCKING" : "MAJOR",
    }),
    rationaleTemplate: null,
    scope: parsed.data.scope,
    enabled: true,
    createdByUserId: session.user.id,
  });

  revalidatePath("/rules");
}

export async function updateCustomRuleAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sign in to manage rules");

  const ruleId = String(formData.get("ruleId") ?? "");
  if (!ruleId) throw new Error("Missing ruleId");

  const parsed = ruleFormSchema.safeParse({
    displayName: formData.get("displayName"),
    description: formData.get("description"),
    severity: formData.get("severity"),
    scope: formData.get("scope"),
    prompt: formData.get("prompt"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const [existing] = await db.select().from(criticRules).where(eq(criticRules.id, ruleId)).limit(1);
  if (!existing) throw new Error("Rule not found");
  if (existing.source !== "custom") throw new Error("Built-in rules cannot be edited");

  await db
    .update(criticRules)
    .set({
      displayName: parsed.data.displayName,
      description: parsed.data.description,
      severity: parsed.data.severity,
      scope: parsed.data.scope,
      evaluatorConfig: JSON.stringify({
        prompt: parsed.data.prompt,
        defaultSeverity: parsed.data.severity === "HARD" ? "BLOCKING" : "MAJOR",
      }),
      updatedAt: new Date(),
    })
    .where(eq(criticRules.id, ruleId));

  revalidatePath("/rules");
}

export async function toggleRuleAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sign in to manage rules");

  const ruleId = String(formData.get("ruleId") ?? "");
  const enabled = formData.get("enabled") === "true";
  if (!ruleId) throw new Error("Missing ruleId");

  await db
    .update(criticRules)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(criticRules.id, ruleId));

  revalidatePath("/rules");
}

export async function deleteCustomRuleAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Sign in to manage rules");

  const ruleId = String(formData.get("ruleId") ?? "");
  if (!ruleId) throw new Error("Missing ruleId");

  const [existing] = await db.select().from(criticRules).where(eq(criticRules.id, ruleId)).limit(1);
  if (!existing) throw new Error("Rule not found");
  if (existing.source !== "custom") {
    throw new Error("Built-in rules cannot be deleted — disable instead");
  }

  await db.delete(criticRules).where(eq(criticRules.id, ruleId));
  revalidatePath("/rules");
}
