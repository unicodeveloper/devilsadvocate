import type { Memo } from "../db/schema";
import type {
  Citation,
  Finding,
  HouseViewRuleEvaluation,
  SynthesizedMemo,
} from "../agents/types";

type PdfInput = {
  memo: Memo;
  synthesized: SynthesizedMemo;
  generatedAt: Date;
  reviewer?: { name: string | null; comment: string | null } | null;
};

const PRINT_CSS = `
@page { size: A4; margin: 18mm 16mm 22mm 16mm; }
@page { @bottom-center { content: counter(page) " · Devil's Advocate Investment Memo"; font-size: 8pt; color: #737373; } }
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #1a1a1a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.cover { border-bottom: 1px solid #d4d4d8; padding-bottom: 14pt; margin-bottom: 18pt; }
.cover .ticker { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10pt; color: #525252; letter-spacing: 0.04em; }
.cover h1 { font-size: 22pt; margin: 4pt 0 6pt 0; line-height: 1.15; }
.cover .meta { font-size: 9pt; color: #525252; }
.cover .reviewer { margin-top: 8pt; font-size: 9pt; color: #404040; }
section { page-break-inside: avoid; margin-bottom: 18pt; }
section h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.08em; color: #737373; margin: 0 0 8pt 0; font-weight: 600; }
.verdict { border: 1px solid; border-radius: 6pt; padding: 12pt 14pt; margin-bottom: 18pt; page-break-inside: avoid; }
.verdict.constructive { border-color: #6ee7b7; background: #ecfdf5; }
.verdict.cautious { border-color: #fcd34d; background: #fffbeb; }
.verdict.avoid { border-color: #fca5a5; background: #fef2f2; }
.verdict.inconclusive { border-color: #d4d4d8; background: #fafafa; }
.verdict .label { font-size: 13pt; font-weight: 700; text-transform: capitalize; }
.verdict .conf { display: inline-block; font-size: 8pt; padding: 2pt 6pt; border-radius: 999pt; margin-left: 8pt; vertical-align: middle; font-weight: 500; }
.verdict p { margin: 6pt 0 0 0; }
.metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8pt; margin-top: 10pt; }
.metric { border: 1px solid #e5e5e5; border-radius: 4pt; padding: 8pt 10pt; }
.metric .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #737373; }
.metric .value { font-size: 11pt; font-weight: 600; margin-top: 2pt; }
.finding, .rule { border: 1px solid #e5e5e5; border-radius: 4pt; padding: 10pt 12pt; margin-bottom: 8pt; page-break-inside: avoid; }
.finding .head, .rule .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
.finding .title, .rule .title { font-weight: 600; font-size: 10.5pt; }
.finding .body, .rule .body { margin: 4pt 0 6pt 0; color: #262626; }
.finding .basis { font-size: 8.5pt; font-style: italic; color: #737373; margin-bottom: 4pt; }
.cites { display: flex; flex-wrap: wrap; gap: 4pt; margin-top: 4pt; }
.cite { font-size: 8pt; padding: 2pt 6pt; border: 1px solid #e5e5e5; border-radius: 3pt; background: #fafafa; color: #404040; }
.cite a { color: inherit; text-decoration: none; }
.conf-pill { font-size: 8pt; padding: 2pt 6pt; border-radius: 999pt; font-weight: 500; white-space: nowrap; }
.conf-high { background: #d1fae5; color: #065f46; }
.conf-medium { background: #fef3c7; color: #92400e; }
.conf-low { background: #f4f4f5; color: #404040; }
.verdict-pill { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.verdict-pass { color: #047857; }
.verdict-fail { color: #b91c1c; }
.verdict-na { color: #737373; }
.house-headline { font-weight: 600; margin: 0 0 6pt 0; }
.blind-spots { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 4pt; padding: 10pt 12pt; margin-top: 8pt; }
.blind-spots ul { margin: 4pt 0 0 16pt; padding: 0; }
`;

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "high confidence",
  medium: "medium confidence",
  low: "low confidence",
};

export function renderMemoToHtml({
  memo,
  synthesized,
  generatedAt,
  reviewer,
}: PdfInput): string {
  const v = synthesized.finalVerdict;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(memo.stockTicker ?? "Memo")} · Investment Memo</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${cover(memo, generatedAt, reviewer)}
${verdictBlock(v)}
${setupSection(synthesized)}
${houseViewSection(synthesized)}
${stressTestSection(synthesized)}
${consensusSection(synthesized)}
</body>
</html>`;
}

function cover(
  memo: Memo,
  generatedAt: Date,
  reviewer: PdfInput["reviewer"],
): string {
  const reviewerLine = reviewer
    ? `<div class="reviewer">Reviewer: ${esc(reviewer.name ?? "CIO")}${
        reviewer.comment ? ` — &ldquo;${esc(reviewer.comment)}&rdquo;` : ""
      }</div>`
    : "";
  return `<header class="cover">
    <div class="ticker">${esc(memo.stockTicker ?? "—")}${memo.stockExchange ? ` · ${esc(memo.stockExchange)}` : ""}</div>
    <h1>${esc(memo.stockName ?? "Untitled")}</h1>
    <div class="meta">Investment Memo · Generated ${esc(formatDate(generatedAt))} · Status: ${esc(memo.status.replace("_", " "))}</div>
    ${reviewerLine}
  </header>`;
}

function verdictBlock(v: SynthesizedMemo["finalVerdict"]): string {
  return `<div class="verdict ${esc(v.label)}">
    <div>
      <span class="label">${esc(v.label)}</span>
      <span class="conf conf-pill conf-${esc(v.confidence)}">${esc(CONFIDENCE_LABEL[v.confidence] ?? v.confidence)}</span>
    </div>
    <p>${esc(v.reasoning)}</p>
  </div>`;
}

function setupSection(s: SynthesizedMemo): string {
  const metrics = s.setup.keyMetrics
    .map(
      (m) =>
        `<div class="metric">
          <div class="label">${esc(m.label)}</div>
          <div class="value">${esc(m.value)}</div>
          ${m.source ? citationsBlock([m.source]) : ""}
        </div>`,
    )
    .join("");
  return `<section>
    <h2>The Setup</h2>
    <p>${esc(s.setup.summary)}</p>
    ${metrics ? `<div class="metrics">${metrics}</div>` : ""}
  </section>`;
}

function houseViewSection(s: SynthesizedMemo): string {
  const rules = s.houseViewOverlay.ruleVerdicts.map(ruleRow).join("");
  return `<section>
    <h2>House View Overlay</h2>
    <p class="house-headline">${esc(s.houseViewOverlay.headline)}</p>
    <p>${esc(s.houseViewOverlay.body)}</p>
    ${rules}
  </section>`;
}

function stressTestSection(s: SynthesizedMemo): string {
  const findings = s.stressTest.findings.map(findingRow).join("");
  const blindSpots =
    s.stressTest.blindSpots.length > 0
      ? `<div class="blind-spots"><strong>Blind spots — investigate further</strong>
          <ul>${s.stressTest.blindSpots.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
        </div>`
      : "";
  return `<section>
    <h2>The Reasoning Stress-Test</h2>
    <p>${esc(s.stressTest.summary)}</p>
    ${findings}
    ${blindSpots}
  </section>`;
}

function consensusSection(s: SynthesizedMemo): string {
  const notes = (s.consensusSummary.notes ?? []).map(findingRow).join("");
  return `<section>
    <h2>Consensus Summary</h2>
    <p>${esc(s.consensusSummary.headline)}</p>
    ${notes}
  </section>`;
}

function findingRow(f: Finding): string {
  return `<div class="finding">
    <div class="head">
      <span class="title">${esc(f.title)}</span>
      <span class="conf-pill conf-${esc(f.confidence)}">${esc(f.confidence)}</span>
    </div>
    <p class="body">${esc(f.body)}</p>
    <div class="basis">Evidence basis: ${esc(f.evidenceBasis)}</div>
    ${citationsBlock(f.citations)}
  </div>`;
}

function ruleRow(r: HouseViewRuleEvaluation): string {
  const verdictClass = r.verdict === "n_a" ? "na" : r.verdict;
  const verdictLabel = r.verdict === "n_a" ? "N/A" : r.verdict;
  return `<div class="rule">
    <div class="head">
      <span class="title">${esc(r.rule)}</span>
      <span class="verdict-pill verdict-${esc(verdictClass)}">${esc(verdictLabel)}</span>
    </div>
    <p class="body">${esc(r.reasoning)}</p>
    ${r.evidence.length ? citationsBlock(r.evidence) : ""}
  </div>`;
}

function citationsBlock(citations: Citation[]): string {
  if (citations.length === 0) return "";
  return `<div class="cites">${citations
    .map((c) => {
      const isUrl = /^https?:\/\//.test(c.url);
      const label = c.title ?? (isUrl ? hostnameOf(c.url) : c.url);
      return `<span class="cite">${
        isUrl ? `<a href="${esc(c.url)}">${esc(label)}</a>` : esc(label)
      }</span>`;
    })
    .join("")}</div>`;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
