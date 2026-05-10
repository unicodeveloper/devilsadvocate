import type { Fund, Memo } from "../db/schema";
import { formatUSD, toUSD } from "../fx";
import type {
  Citation,
  Finding,
  FundHouseViewRuleEvaluation,
  FundSynthesizedMemo,
  HoldingRef,
} from "../agents/types";

type FundPdfInput = {
  memo: Memo;
  fund: Fund;
  synthesized: FundSynthesizedMemo;
  generatedAt: Date;
  reviewer?: { name: string | null; comment: string | null } | null;
};

const PRINT_CSS = `
@page { size: A4; margin: 18mm 16mm 22mm 16mm; }
@page { @bottom-center { content: counter(page) " · Mandate Fund Memo"; font-size: 8pt; color: #737373; } }
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt; line-height: 1.5; color: #1a1a1a;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.cover { border-bottom: 1px solid #d4d4d8; padding-bottom: 14pt; margin-bottom: 18pt; }
.cover .badge { display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9pt; padding: 1pt 6pt; border: 1px solid #d4d4d8; border-radius: 999pt; color: #525252; letter-spacing: 0.04em; text-transform: uppercase; }
.cover h1 { font-size: 22pt; margin: 6pt 0 4pt 0; line-height: 1.15; }
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
.verdict-mixed { color: #b45309; }
.verdict-na { color: #737373; }
.house-headline { font-weight: 600; margin: 0 0 6pt 0; }
table.tilts, table.violators { width: 100%; border-collapse: collapse; margin-top: 8pt; font-size: 9pt; }
table.tilts th, table.tilts td, table.violators th, table.violators td { padding: 4pt 8pt; border-bottom: 1px solid #e5e5e5; text-align: left; }
table.tilts th, table.violators th { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.06em; color: #737373; }
table.violators { border: 1px solid #fca5a5; background: #fef2f2; border-radius: 4pt; margin-top: 8pt; }
table.violators th { background: #fee2e2; color: #991b1b; }
.right { text-align: right; }
.weighted-violation { color: #b91c1c; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8.5pt; }
.blind-spots { background: #fafafa; border: 1px solid #e5e5e5; border-radius: 4pt; padding: 10pt 12pt; margin-top: 8pt; }
.blind-spots ul { margin: 4pt 0 0 16pt; padding: 0; }
`;

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "high confidence",
  medium: "medium confidence",
  low: "low confidence",
};

const FUND_TYPE_LABEL: Record<string, string> = {
  mf: "Mutual Fund",
  pms: "PMS",
  aif: "AIF",
};

export function renderFundMemoToHtml({
  memo,
  fund,
  synthesized,
  generatedAt,
  reviewer,
}: FundPdfInput): string {
  const v = synthesized.finalVerdict;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${esc(fund.name)} · Fund Memo</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${cover(memo, fund, generatedAt, reviewer)}
${verdictBlock(v)}
${setupSection(synthesized)}
${portfolioSection(synthesized)}
${houseViewSection(synthesized)}
${stressTestSection(synthesized)}
</body>
</html>`;
}

function cover(
  memo: Memo,
  fund: Fund,
  generatedAt: Date,
  reviewer: FundPdfInput["reviewer"],
): string {
  const reviewerLine = reviewer
    ? `<div class="reviewer">Reviewer: ${esc(reviewer.name ?? "CIO")}${
        reviewer.comment ? ` — &ldquo;${esc(reviewer.comment)}&rdquo;` : ""
      }</div>`
    : "";
  const subline = [
    fund.fundManager ? `Manager: ${fund.fundManager}` : null,
    fund.aumNative ? `AUM ${formatUSD(toUSD(fund.aumNative, fund.currency))}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return `<header class="cover">
    <span class="badge">${esc(FUND_TYPE_LABEL[fund.type] ?? fund.type)}</span>
    <h1>${esc(fund.name)}</h1>
    <div class="meta">${esc(subline)}</div>
    <div class="meta">Fund Investment Memo · Generated ${esc(formatDate(generatedAt))} · Status: ${esc(memo.status.replace("_", " "))}</div>
    ${reviewerLine}
  </header>`;
}

function verdictBlock(v: FundSynthesizedMemo["finalVerdict"]): string {
  return `<div class="verdict ${esc(v.label)}">
    <div>
      <span class="label">${esc(v.label)}</span>
      <span class="conf conf-pill conf-${esc(v.confidence)}">${esc(CONFIDENCE_LABEL[v.confidence] ?? v.confidence)}</span>
    </div>
    <p>${esc(v.reasoning)}</p>
  </div>`;
}

function setupSection(s: FundSynthesizedMemo): string {
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

function portfolioSection(s: FundSynthesizedMemo): string {
  const tilts = s.portfolioComposition.sectorTilts
    .map(
      (t) => `<tr>
        <td>${esc(t.sector)}</td>
        <td class="right">${t.weightPct.toFixed(2)}%</td>
        <td>${esc(t.commentary)}</td>
      </tr>`,
    )
    .join("");
  const tiltsTable = tilts
    ? `<table class="tilts">
        <thead><tr><th>Sector</th><th class="right">Weight</th><th>Commentary</th></tr></thead>
        <tbody>${tilts}</tbody>
      </table>`
    : "";
  const commentary = s.portfolioComposition.topHoldingsCommentary
    .map(findingRow)
    .join("");
  return `<section>
    <h2>Portfolio Composition</h2>
    <p class="house-headline">${esc(s.portfolioComposition.headline)}</p>
    ${tiltsTable}
    ${commentary}
  </section>`;
}

function houseViewSection(s: FundSynthesizedMemo): string {
  const rules = s.houseViewOverlay.ruleVerdicts.map(ruleRow).join("");
  return `<section>
    <h2>House View Overlay</h2>
    <p class="house-headline">${esc(s.houseViewOverlay.headline)}</p>
    <p>${esc(s.houseViewOverlay.body)}</p>
    ${rules}
  </section>`;
}

function stressTestSection(s: FundSynthesizedMemo): string {
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

function ruleRow(r: FundHouseViewRuleEvaluation): string {
  const verdictClass = r.verdict === "n_a" ? "na" : r.verdict;
  const verdictLabel = r.verdict === "n_a" ? "N/A" : r.verdict;
  const violators = r.violatingHoldings.length > 0 ? violatorsTable(r.violatingHoldings) : "";
  const weighted =
    r.weightedViolationPct > 0
      ? `<span class="weighted-violation">${r.weightedViolationPct.toFixed(2)}% in violation</span>`
      : "";
  return `<div class="rule">
    <div class="head">
      <span class="title">${esc(r.rule)}</span>
      <span style="display:flex;gap:8pt;align-items:baseline;">
        ${weighted}
        <span class="verdict-pill verdict-${esc(verdictClass)}">${esc(verdictLabel)}</span>
      </span>
    </div>
    <p class="body">${esc(r.reasoning)}</p>
    ${violators}
    ${r.evidence.length ? citationsBlock(r.evidence) : ""}
  </div>`;
}

function violatorsTable(rows: HoldingRef[]): string {
  return `<table class="violators">
    <thead><tr><th>Ticker</th><th>Name</th><th class="right">Weight</th><th>Reason</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (h) => `<tr>
            <td>${esc(h.ticker)}</td>
            <td>${esc(h.name)}</td>
            <td class="right">${h.weightPct.toFixed(2)}%</td>
            <td>${esc(h.reason ?? "—")}</td>
          </tr>`,
        )
        .join("")}
    </tbody>
  </table>`;
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
