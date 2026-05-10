import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { criticRules, type CriticRule } from "@/lib/db/schema";
import { PageHeader } from "@/components/app-shell";
import { RulesClient, type RuleVm } from "./rules-client";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const session = await auth();
  if (!session) {
    redirect("/login?from=/rules");
  }

  const rows = await db
    .select()
    .from(criticRules)
    .orderBy(asc(criticRules.source), asc(criticRules.displayName));

  const rules = rows.map(toViewModel);
  const builtIn = rules.filter((r) => r.source !== "custom");
  const custom = rules.filter((r) => r.source === "custom");
  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Critic engine"
        title="CIO Critic rules"
        description={`${rules.length} rule${rules.length === 1 ? "" : "s"} · ${enabledCount} enabled. Built-in rules ship with the app; custom rules are LLM-evaluated against every memo on submit.`}
      />

      <RulesClient builtIn={builtIn} custom={custom} />
    </div>
  );
}

function toViewModel(row: CriticRule): RuleVm {
  let prompt: string | null = null;
  if (row.evaluatorKind === "ai") {
    try {
      const cfg = JSON.parse(row.evaluatorConfig ?? "{}");
      if (typeof cfg.prompt === "string") prompt = cfg.prompt;
    } catch {
      // ignore malformed config
    }
  }
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    description: row.description,
    severity: row.severity as "HARD" | "SOFT",
    source: row.source as "house_view" | "builtin" | "custom",
    scope: row.scope as "stock" | "fund" | "both",
    evaluatorKind: row.evaluatorKind as "code" | "ai",
    enabled: row.enabled,
    prompt,
    updatedAt: row.updatedAt.toISOString(),
  };
}
