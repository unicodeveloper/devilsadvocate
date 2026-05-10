import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "../../db";
import { criticRules, type CriticRule } from "../../db/schema";
import type { RuleDefinition, Severity } from "../types";
import { BUILTIN_RULES, RULES_BY_SLUG } from "./builtin";
import { aiRuleEvaluator, type AIEvaluatorConfig } from "./ai-evaluator";

export { BUILTIN_RULES, RULES_BY_SLUG };

export type ResolvedRuleSet = {
  rules: RuleDefinition[];
  hash: string;
};

/**
 * Loads enabled rules from the DB and resolves each row into a runnable
 * RuleDefinition:
 *   - "code" rows look up their evaluator in the BUILTIN_RULES registry
 *   - "ai" rows synthesize an evaluator that calls the LLM with the user-
 *     provided prompt
 */
export async function loadEnabledRules(scope: "stock" | "fund"): Promise<ResolvedRuleSet> {
  const rows = await db.select().from(criticRules).where(eq(criticRules.enabled, true));
  const resolved: RuleDefinition[] = [];

  for (const row of rows) {
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
