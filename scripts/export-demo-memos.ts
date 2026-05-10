/**
 * One-off: dump 4 chosen memos + their latest run/review/objections/threads
 * to src/lib/db/seed-data/demo-memos.json so they can be re-seeded on a fresh
 * deploy. Run once locally, then delete this script.
 *
 *   npx tsx scripts/export-demo-memos.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

const sqlite = new Database("./data/sqlite.db", { readonly: true });

const MEMO_IDS = [
  "c48177bc-0b19-433c-8bc7-64a1951a53b1", // fund — Parag Parikh — rejected
  "a4493b40-b5de-40dc-96cb-dc8d4368882e", // SNDK — changes_requested
  "e856a258-e154-44aa-8753-484f391b6fed", // ASML — approved
  "56b549d1-f4ab-448d-9b0d-398ae0243fa8", // MRVL — approved
] as const;

type Row = Record<string, unknown>;

function all(sql: string, params: unknown[] = []): Row[] {
  return sqlite.prepare(sql).all(...params) as Row[];
}

function one(sql: string, params: unknown[] = []): Row | undefined {
  return sqlite.prepare(sql).get(...params) as Row | undefined;
}

const out: Array<Record<string, unknown>> = [];

for (const memoId of MEMO_IDS) {
  const memo = one(`SELECT * FROM memos WHERE id = ?`, [memoId]);
  if (!memo) {
    console.warn(`skip ${memoId} (not found)`);
    continue;
  }

  // Resolve fund-memo's fund name so seed can map fund_id at insert time.
  let fundName: string | null = null;
  if (memo.entity_type === "fund" && memo.fund_id) {
    const fund = one(`SELECT name FROM funds WHERE id = ?`, [memo.fund_id]);
    fundName = (fund?.name as string | undefined) ?? null;
  }

  const latestRun = one(
    `SELECT * FROM memo_runs WHERE memo_id = ? AND status = 'completed' ORDER BY finished_at DESC LIMIT 1`,
    [memoId],
  );

  const latestReview = one(
    `SELECT * FROM reviews WHERE memo_id = ? ORDER BY finished_at DESC NULLS LAST LIMIT 1`,
    [memoId],
  );

  let objections: Row[] = [];
  let threads: Row[] = [];
  if (latestReview) {
    objections = all(`SELECT * FROM objections WHERE review_id = ? ORDER BY created_at`, [
      latestReview.id,
    ]);
    if (objections.length > 0) {
      const placeholders = objections.map(() => "?").join(",");
      threads = all(
        `SELECT * FROM objection_threads WHERE objection_id IN (${placeholders}) ORDER BY created_at`,
        objections.map((o) => o.id),
      );
    }
  }

  out.push({
    memo,
    fundName,
    latestRun: latestRun ?? null,
    latestReview: latestReview ?? null,
    objections,
    threads,
  });
}

const dest = "./src/lib/db/seed-data/demo-memos.json";
mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(
  `wrote ${out.length} memos with relations to ${dest} (${(JSON.stringify(out).length / 1024).toFixed(1)} KB)`,
);
