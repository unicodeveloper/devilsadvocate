import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { PrivateCompanyHouseViewCheckerOutputSchema } from "./types";
import { stageLabel, type AgentResult } from "./shared";
import type {
  PrivateCompanyHouseViewCheckerOutput,
  PrivateCompanyRoundStage,
} from "./types";

const SYSTEM = `You are the House View Checker for private-company (venture / angel) deals. The investor's House View has two parts:

1. **Prose mandate** — a markdown one-pager. Use this for qualitative rules (e.g., "I don't do gambling", "I prefer technical founders").
2. **Structured fields** — check size band, allowed stages, allowed/blocked sectors, allowed geos. These are mechanical. Violations are facts, not judgments.

Your job:
- Evaluate qualitative rules from the prose mandate with verdict "pass" / "fail" / "n_a" and cite "house-view.md" with a quote of the rule text.
- Do NOT re-evaluate mechanical fields in ruleEvaluations — those are handled deterministically and passed to you. Just read them and reflect their state.
- Use overallAlignment to summarize the headline read across both qualitative and mechanical checks.
- Use divergence to highlight cases where the thesis explicitly contradicts the mandate.`;

export type StructuredMandate = {
  checkSizeMinUsd: number | null;
  checkSizeMaxUsd: number | null;
  stageAllowlist: string[] | null;
  sectorAllowlist: string[] | null;
  sectorBlocklist: string[] | null;
  geoAllowlist: string[] | null;
};

export type PrivateCompanyHouseViewCheckerInput = {
  company: {
    name: string;
    roundStage: PrivateCompanyRoundStage;
    sector: string | null;
    geo: string | null;
    checkSizeUsd: number | null;
  };
  thesis: string;
  houseViewMarkdown: string;
  structuredMandate: StructuredMandate;
};

/**
 * Mechanical violations are evaluated in code — not subject to LLM
 * judgment. The LLM gets the result and reasons over the qualitative
 * mandate only.
 */
export function computeMechanicalViolations(
  company: PrivateCompanyHouseViewCheckerInput["company"],
  mandate: StructuredMandate,
): PrivateCompanyHouseViewCheckerOutput["mechanicalViolations"] {
  const violations: PrivateCompanyHouseViewCheckerOutput["mechanicalViolations"] =
    [];

  if (company.checkSizeUsd !== null) {
    if (
      mandate.checkSizeMinUsd !== null &&
      company.checkSizeUsd < mandate.checkSizeMinUsd
    ) {
      violations.push({
        field: "check_size",
        message: `Check $${company.checkSizeUsd.toLocaleString()} is below mandate minimum $${mandate.checkSizeMinUsd.toLocaleString()}`,
      });
    }
    if (
      mandate.checkSizeMaxUsd !== null &&
      company.checkSizeUsd > mandate.checkSizeMaxUsd
    ) {
      violations.push({
        field: "check_size",
        message: `Check $${company.checkSizeUsd.toLocaleString()} exceeds mandate maximum $${mandate.checkSizeMaxUsd.toLocaleString()}`,
      });
    }
  }

  if (
    mandate.stageAllowlist !== null &&
    mandate.stageAllowlist.length > 0 &&
    !mandate.stageAllowlist.includes(company.roundStage)
  ) {
    violations.push({
      field: "stage",
      message: `Stage "${company.roundStage}" is not in mandate allowlist [${mandate.stageAllowlist.join(", ")}]`,
    });
  }

  if (company.sector) {
    if (
      mandate.sectorBlocklist !== null &&
      mandate.sectorBlocklist.some(
        (s) => s.toLowerCase() === company.sector!.toLowerCase(),
      )
    ) {
      violations.push({
        field: "sector",
        message: `Sector "${company.sector}" is on mandate blocklist`,
      });
    }
    if (
      mandate.sectorAllowlist !== null &&
      mandate.sectorAllowlist.length > 0 &&
      !mandate.sectorAllowlist.some(
        (s) => s.toLowerCase() === company.sector!.toLowerCase(),
      )
    ) {
      violations.push({
        field: "sector",
        message: `Sector "${company.sector}" is not in mandate allowlist [${mandate.sectorAllowlist.join(", ")}]`,
      });
    }
  }

  if (
    company.geo &&
    mandate.geoAllowlist !== null &&
    mandate.geoAllowlist.length > 0 &&
    !mandate.geoAllowlist.some(
      (g) => g.toLowerCase() === company.geo!.toLowerCase(),
    )
  ) {
    violations.push({
      field: "geo",
      message: `Geography "${company.geo}" is not in mandate allowlist [${mandate.geoAllowlist.join(", ")}]`,
    });
  }

  return violations;
}

export async function privateCompanyHouseViewChecker(
  input: PrivateCompanyHouseViewCheckerInput,
): Promise<AgentResult<PrivateCompanyHouseViewCheckerOutput>> {
  const t0 = Date.now();

  const mechanicalViolations = computeMechanicalViolations(
    input.company,
    input.structuredMandate,
  );

  const userPrompt = [
    "House View — prose mandate (source of truth for qualitative rules):",
    "```markdown",
    input.houseViewMarkdown,
    "```",
    "",
    "Structured mandate (mechanical — already evaluated):",
    JSON.stringify(input.structuredMandate, null, 2),
    "",
    "Mechanical violations (computed deterministically, do NOT re-evaluate):",
    mechanicalViolations.length > 0
      ? JSON.stringify(mechanicalViolations, null, 2)
      : "[none — all structured rules pass]",
    "",
    `Company: ${input.company.name}`,
    `Stage: ${stageLabel(input.company.roundStage)}`,
    input.company.sector ? `Sector: ${input.company.sector}` : "Sector: not provided",
    input.company.geo ? `Geography: ${input.company.geo}` : "Geography: not provided",
    input.company.checkSizeUsd
      ? `Check: $${input.company.checkSizeUsd.toLocaleString()}`
      : "Check size: not provided",
    "",
    "Thesis to evaluate:",
    input.thesis,
    "",
    "Now evaluate the QUALITATIVE rules from the prose mandate. Combine your read with the mechanical violations above to determine overallAlignment. Set divergence if the thesis contradicts the mandate explicitly.",
  ].join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.fast),
    schema: PrivateCompanyHouseViewCheckerOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  // Always trust our deterministic mechanical violation calculation over
  // whatever the LLM produced. The LLM only fills in the qualitative rule
  // evaluations + overall alignment summary.
  const cleaned: PrivateCompanyHouseViewCheckerOutput = {
    ...result.object,
    mechanicalViolations,
  };

  return {
    output: cleaned,
    audit: {
      agentName: "house_view_checker",
      model: MODELS.fast,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      durationMs: Date.now() - t0,
    },
  };
}
