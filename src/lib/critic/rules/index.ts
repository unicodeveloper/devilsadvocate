import { and, eq, isNull, or } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../../db";
import {
  criticRules,
  criticRuleUserSettings,
  type CriticRule,
} from "../../db/schema";
import type { RuleDefinition, Severity } from "../types";
import { BUILTIN_RULES, RULES_BY_SLUG } from "./builtin";
import { aiRuleEvaluator, type AIEvaluatorConfig } from "./ai-evaluator";

export { BUILTIN_RULES, RULES_BY_SLUG };

export type ResolvedRuleSet = {
  rules: RuleDefinition[];
  hash: string;
};

/**
 * Loads the effective ruleset for a memo authored by `ownerUserId`.
 *
 * The set is:
 *   - all built-ins (owner_user_id IS NULL), with this user's per-user
 *     enabled override applied (or the rule's default if no override),
 *   - PLUS the user's own custom rules (owner_user_id = ownerUserId), using
 *     the rule's own `enabled` column directly.
 *
 * Built-ins disabled by one FM stay enabled for everyone else. Custom rules
 * stay private to the author and only ever judge their memos.
 */
export async function loadEnabledRules(
  scope: "stock" | "fund",
  ownerUserId: string,
): Promise<ResolvedRuleSet> {
  // Pull rules visible to this user: built-ins (no owner) + their own customs.
  const rows = await db
    .select()
    .from(criticRules)
    .where(
      or(
        isNull(criticRules.ownerUserId),
        eq(criticRules.ownerUserId, ownerUserId),
      ),
    );

  // Pull this user's per-rule enabled overrides in a single query, keyed by
  // rule id. Absence of a row means "use the rule's default enabled state."
  const overrides = await db
    .select()
    .from(criticRuleUserSettings)
    .where(eq(criticRuleUserSettings.userId, ownerUserId));
  const overrideByRuleId = new Map(overrides.map((s) => [s.ruleId, s.enabled]));

  const resolved: RuleDefinition[] = [];
  for (const row of rows) {
    const effectiveEnabled =
      overrideByRuleId.get(row.id) ?? row.enabled;
    if (!effectiveEnabled) continue;
    if (row.scope !== "both" && row.scope !== scope) continue;
    const def = resolveRule(row);
    if (def) resolved.push(def);
  }

  // Hash drives review reproducibility — change a rule, change the hash.
  const hash = createHash("sha256")
    .update(
      resolved
        .map((r) => `${r.slug}:${r.severity}:${r.source}`)
        .join("|"),
    )
    .digest("hex")
    .slice(0, 16);

  return { rules: resolved, hash };
}

function resolveRule(row: CriticRule): RuleDefinition | null {
  if (row.evaluatorKind === "code") {
    return RULES_BY_SLUG[row.slug] ?? null;
  }
  if (row.evaluatorKind === "ai") {
    const cfg = parseAiConfig(row.evaluatorConfig);
    if (!cfg) return null;
    return {
      slug: row.slug,
      displayName: row.displayName,
      description: row.description,
      severity: row.severity,
      source: row.source,
      scope: row.scope,
      rationaleTemplate: row.rationaleTemplate,
      evaluator: aiRuleEvaluator({
        slug: row.slug,
        config: cfg,
        ruleSeverity: row.severity,
      }),
    };
  }
  return null;
}

function parseAiConfig(json: string): AIEvaluatorConfig | null {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed.prompt !== "string" || parsed.prompt.length === 0) return null;
    const sev: Severity = parsed.defaultSeverity ?? "MAJOR";
    return { prompt: parsed.prompt, defaultSeverity: sev };
  } catch {
    return null;
  }
}

/**
 * Resolves the *effective* enabled state for a rule from this user's
 * perspective. Used by the rules UI to show the right toggle state.
 *
 * The override map should be loaded once for the user and passed in to
 * avoid N queries when rendering a list.
 */
export function effectiveEnabled(
  rule: { id: string; enabled: boolean },
  overrideByRuleId: Map<string, boolean>,
): boolean {
  const override = overrideByRuleId.get(rule.id);
  return override ?? rule.enabled;
}

/**
 * Loads all per-rule enabled overrides for a given user, keyed by rule id.
 */
export async function loadUserRuleOverrides(
  userId: string,
): Promise<Map<string, boolean>> {
  const rows = await db
    .select()
    .from(criticRuleUserSettings)
    .where(eq(criticRuleUserSettings.userId, userId));
  return new Map(rows.map((s) => [s.ruleId, s.enabled]));
}

/**
 * Upsert a per-user enabled override for a built-in rule.
 */
export async function setUserRuleEnabled(
  userId: string,
  ruleId: string,
  enabled: boolean,
): Promise<void> {
  const existing = await db
    .select()
    .from(criticRuleUserSettings)
    .where(
      and(
        eq(criticRuleUserSettings.userId, userId),
        eq(criticRuleUserSettings.ruleId, ruleId),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(criticRuleUserSettings)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(criticRuleUserSettings.id, existing[0].id));
    return;
  }
  await db.insert(criticRuleUserSettings).values({
    userId,
    ruleId,
    enabled,
  });
}
