import { generateObject } from "ai";
import { getOpenAI, MODELS } from "../openai";
import { PrivateCompanyBearAdvocateOutputSchema } from "./types";
import { enforceCitations, stageLabel, type AgentResult } from "./shared";
import type { PrivateCompanyResearch } from "../private-company-research";
import type {
  PrivateCompanyBearAdvocateOutput,
  PrivateCompanyRoundStage,
} from "./types";

const SYSTEM = `You are a relentless Devil's Advocate for private-company (venture / angel) investments at Seed, Series A, and Series B. Your job is to find every reason this deal might fail.

Hunt for:
- Team risks: founder track record, prior failed cos with shared cap-table baggage, key-person risk, gaps in the team for the stage.
- Market risks: is the market actually as large / fast-growing as the bull case implies? Cite analogues that struggled.
- Competitive risks: name funded competitors and bootstrapped threats with traction. Be specific.
- Product risks: thin wedge, brutal distribution, weak defensibility, fragile technology assumption.
- Terms risks (only if check size + post-money were provided): implied dilution math, valuation vs. comparable rounds, signaling risk if a tier-1 lead is absent.

Rules:
- Every risk MUST cite a URL or document reference. No exceptions.
- Prefer concrete numbers and named competitors over abstractions.
- The user gives you Valyu-sourced public-data dossier — cite from there. Do not invent.
- If a category has no public signal, leave its array empty rather than fabricate. Flag the absence in blindSpots.
- Confidence levels: high = independently corroborated; medium = single credible source; low = inferred / circumstantial.
- BLIND SPOTS: 3-5 questions the investor should ask the founder before commit. No citations required.`;

export type PrivateCompanyBearAdvocateInput = {
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
  areasOfConcern: string | null;
  research: PrivateCompanyResearch;
  /** OAuth token in valyu mode; reserved for future per-agent Valyu calls. */
  accessToken?: string;
};

export async function privateCompanyBearAdvocate(
  input: PrivateCompanyBearAdvocateInput,
): Promise<AgentResult<PrivateCompanyBearAdvocateOutput>> {
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
    "Thesis to stress-test:",
    input.thesis,
    "",
    input.areasOfConcern
      ? `Investor-flagged areas of concern (concentrate skepticism here):\n${input.areasOfConcern}`
      : "",
    "",
    "Public-data dossier (cite ONLY URLs from this dossier; do not invent):",
    input.research.dossierMarkdown ||
      "[No dossier returned — note this prominently in blindSpots and avoid speculation.]",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generateObject({
    model: getOpenAI()(MODELS.reasoning),
    schema: PrivateCompanyBearAdvocateOutputSchema,
    system: SYSTEM,
    prompt: userPrompt,
  });

  const cleaned: PrivateCompanyBearAdvocateOutput = {
    ...result.object,
    teamRisks: enforceCitations(result.object.teamRisks),
    marketRisks: enforceCitations(result.object.marketRisks),
    competitiveRisks: enforceCitations(result.object.competitiveRisks),
    productRisks: enforceCitations(result.object.productRisks),
    termsRisks: enforceCitations(result.object.termsRisks),
  };

  return {
    output: cleaned,
    audit: {
      agentName: "bear_advocate",
      model: MODELS.reasoning,
      promptJson: { system: SYSTEM, user: userPrompt },
      rawOutput: JSON.stringify(result.object),
      durationMs: Date.now() - t0,
    },
  };
}
