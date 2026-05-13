import type { Citation, Finding } from "./types";

export type AgentName =
  | "bull_advocate"
  | "bear_advocate"
  | "house_view_checker"
  | "synthesizer";

export type AgentAudit = {
  agentName: AgentName;
  model: string;
  promptJson: unknown;
  rawOutput: string;
  valyuResponsesJson?: unknown;
  durationMs: number;
};

export type AgentResult<T> = {
  output: T;
  audit: AgentAudit;
};

export type StockContext = {
  ticker: string;
  name: string;
  exchange?: string | null;
};

/**
 * Strict citation enforcement: drop any finding whose citations array is
 * empty or whose URLs are obviously invalid. This is the last line of
 * defense against hallucinated claims making it into the memo.
 */
export function enforceCitations<F extends Finding>(findings: F[]): F[] {
  return findings.filter(
    (f) =>
      Array.isArray(f.citations) &&
      f.citations.length > 0 &&
      f.citations.every((c) => isLikelyValidUrl(c.url) || isDocumentRef(c.url)),
  );
}

function isLikelyValidUrl(s: string) {
  return /^https?:\/\/.+\..+/.test(s);
}

function isDocumentRef(s: string) {
  // Allow internal references like "house-view.md" or "uploaded:report.pdf"
  return /^(house-view|uploaded:|memo:|ic-memo:)/i.test(s);
}

export type ValyuFileAttachment = {
  data: string;
  filename: string;
  mediaType: string;
  context?: string;
};

export function citationsAsBullets(citations: Citation[]): string {
  return citations
    .map((c) => `- ${c.title ? `${c.title} — ` : ""}${c.url}${c.quote ? `\n    > "${c.quote}"` : ""}`)
    .join("\n");
}

/** Human label for a private-company round stage — used in agent prompts. */
export function stageLabel(stage: "seed" | "series_a" | "series_b"): string {
  if (stage === "series_b") return "Series B";
  if (stage === "series_a") return "Series A";
  return "Seed";
}
