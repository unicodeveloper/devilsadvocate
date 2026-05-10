import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

let _db: BetterSQLite3Database<typeof schema> | null = null;
let _sqlite: Database.Database | null = null;

function init() {
  const dbUrl = process.env.DATABASE_URL ?? "./data/sqlite.db";
  mkdirSync(dirname(dbUrl), { recursive: true });
  const sqlite = new Database(dbUrl);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  return _db;
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    if (!_db) init();
    return Reflect.get(_db as object, prop, receiver);
  },
});

export function getRawSqlite() {
  if (!_sqlite) init();
  return _sqlite!;
}

export { schema };
