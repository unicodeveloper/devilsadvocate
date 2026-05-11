import { asc, eq, isNull, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { criticRules, type CriticRule } from "@/lib/db/schema";
import { loadUserRuleOverrides } from "@/lib/critic/rules";
import { PageHeader } from "@/components/app-shell";
import { RulesClient, type RuleVm } from "./rules-client";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const session = await auth();
  const userId = session?.user.id ?? null;

  // Pull built-ins (always) plus this user's own customs (if signed in).
  // Unauthed visitors see only the built-in catalogue with its default
  // enabled state.
  const where = userId
    ? or(isNull(criticRules.ownerUserId), eq(criticRules.ownerUserId, userId))
    : isNull(criticRules.ownerUserId);

  const rows = await db
    .select()
    .from(criticRules)
    .where(where)
    .orderBy(asc(criticRules.source), asc(criticRules.displayName));

  // Per-user toggle overrides: applied client-side only over built-ins.
  // Custom rules use their own row's `enabled` column.
  const overrides = userId
    ? await loadUserRuleOverrides(userId)
    : new Map<string, boolean>();

  const rules = rows.map((r) => toViewModel(r, overrides));
  const builtIn = rules.filter((r) => r.source !== "custom");
  const custom = rules.filter((r) => r.source === "custom");
  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Critic engine"
        title="CIO Critic rules"
        description={
          session
            ? `${rules.length} rule${rules.length === 1 ? "" : "s"} · ${enabledCount} enabled. Built-in rules are shared across the engine; your custom rules and toggle choices are private to you.`
            : `${rules.length} built-in rule${rules.length === 1 ? "" : "s"} ship with the engine. Sign in to add your own custom rules or override built-ins for your memos.`
        }
      />

      <RulesClient
        builtIn={builtIn}
        custom={custom}
        canEdit={Boolean(session)}
      />
    </div>
  );
}

function toViewModel(
  row: CriticRule,
  overrides: Map<string, boolean>,
): RuleVm {
  let prompt: string | null = null;
  if (row.evaluatorKind === "ai") {
    try {
      const cfg = JSON.parse(row.evaluatorConfig ?? "{}");
      if (typeof cfg.prompt === "string") prompt = cfg.prompt;
    } catch {
      // ignore malformed config
    }
  }
  const isCustom = row.source === "custom";
  const effectiveEnabled = isCustom
    ? row.enabled
    : (overrides.get(row.id) ?? row.enabled);
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.displayName,
    description: row.description,
    severity: row.severity as "HARD" | "SOFT",
    source: row.source as "house_view" | "builtin" | "custom",
    scope: row.scope as "stock" | "fund" | "both",
    evaluatorKind: row.evaluatorKind as "code" | "ai",
    enabled: effectiveEnabled,
    prompt,
    updatedAt: row.updatedAt.toISOString(),
  };
}
