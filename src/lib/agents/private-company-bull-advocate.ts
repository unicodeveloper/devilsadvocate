import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { PrivateCompanyBullAdvocateOutputSchema } from "./types";
import { enforceCitations, stageLabel, type AgentResult } from "./shared";
import type { PrivateCompanyResearch } from "../private-company-research";
import type {
  PrivateCompanyBullAdvocateOutput,
  PrivateCompanyRoundStage,
} from "./types";

const SYSTEM = `You are a Bull Advocate analyst for private-company (venture / angel) investments at Seed, Series A, and Series B.

Your job: articulate the strongest defensible case for THIS deal — drawn from public data the angel can actually verify (company website, press, press releases, founder public footprint, hiring signals, competitor positioning).

Rules:
- Every claim MUST cite a real source URL. Findings without citations are stripped.
- Stage matters: at Seed the bull case is mostly about team + market; at Series A you need at least one concrete traction signal; at Series B you need concrete traction AND unit-economics or retention signals (even if directional).
- Do NOT manufacture revenue or growth claims that aren't in the dossier. Public-data only.
- Founder edge: only assert if there's a real public signal (prior co outcome, operator role at a relevant company, deep public technical work). Otherwise return null.
- Product edge and traction signals must come from the dossier — no inference from the website alone.
- Confidence levels: high = independently corroborated; medium = single credible source; low = inferred from indirect signal.`;

export type PrivateCompanyBullAdvocateInput = {
  company: {
    name: string;
    url: string;
    founders: string[];
    roundStage: PrivateCompanyRoundStage;
    sector: string | null;
    geo: string | null;
    checkSizeUsd: number | null;
    postMoneyUsd: number | null;
  };
  thesis: string;
  research: PrivateCompanyResearch;
  /** OAuth token in valyu mode; reserved for future per-agent Valyu calls. */
  accessToken?: string;
};

export async function privateCompanyBullAdvocate(
  input: PrivateCompanyBullAdvocateInput,
): Promise<AgentResult<PrivateCompanyBullAdvocateOutput>> {
  const t0 = Date.now();

  const userPrompt = [
    `Company: ${input.company.name} (${input.company.url})`,
    `Stage: ${stageLabel(input.company.roundStage)}`,
    input.company.founders.length > 0
      ? `Founders: ${input.company.founders.join(", ")}`
      : "",
    input.company.sector ? `Sector: ${input.company.sector}` : "",
    input.company.geo ? `Geography: ${input.company.geo}` : "",
    input.company.checkSizeUsd
      ? `Proposed check: $${input.company.checkSizeUsd.toLocaleString()}`
      : "",
    input.company.postMoneyUsd
      ? `Post-money: $${input.company.postMoneyUsd.toLocaleString()}`
      : "",
    "",
    "Thesis to strengthen:",
    input.thesis,
    "",
    "Public-data dossier (cite ONLY URLs that appear in this dossier; do not invent):",
    input.research.dossierMarkdown ||
      "[No dossier returned — confine the bull case to what can be reasoned from the website URL above, and flag absence of public signal.]",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.fast),
    schema: PrivateCompanyBullAdvocateOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  const cleaned: PrivateCompanyBullAdvocateOutput = {
    ...result.object,
    marketCase: enforceCitations(result.object.marketCase),
    productEdge: enforceCitations(result.object.productEdge),
    tractionSignals: enforceCitations(result.object.tractionSignals),
    founderEdge:
      result.object.founderEdge &&
      result.object.founderEdge.citations.length > 0
        ? result.object.founderEdge
        : null,
  };

  return {
    output: cleaned,
    audit: {
      agentName: "bull_advocate",
      model: MODELS.fast,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      durationMs: Date.now() - t0,
    },
  };
}
