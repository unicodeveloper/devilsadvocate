import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "node:crypto";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const timestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["fund_manager", "cio"] }).notNull(),
  createdAt: timestamp("created_at"),
});

/**
 * Password reset tokens. Single-use; expires within ~1 hour. We never
 * store the raw token — only its SHA-256 hash — so a DB read can't be
 * replayed to take over an account.
 */
export const passwordResetTokens = sqliteTable("password_reset_tokens", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  usedAt: integer("used_at", { mode: "timestamp_ms" }),
  createdAt: timestamp("created_at"),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export const houseViewVersions = sqliteTable("house_view_versions", {
  id: id(),
  content: text("content").notNull(),
  updatedByUserId: text("updated_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at"),
});

export const memos = sqliteTable("memos", {
  id: id(),
  entityType: text("entity_type", { enum: ["stock", "fund"] })
    .notNull()
    .default("stock"),
  // Stock-only fields (null for fund memos)
  stockTicker: text("stock_ticker"),
  stockName: text("stock_name"),
  stockExchange: text("stock_exchange"),
  stockSector: text("stock_sector"),
  // Fund-only field (null for stock memos)
  fundId: text("fund_id").references(() => funds.id, { onDelete: "set null" }),
  thesis: text("thesis").notNull(),
  areasOfConcern: text("areas_of_concern"),
  privatePeers: text("private_peers"),
  status: text("status", {
    enum: [
      "draft",
      "in_review",
      "changes_requested",
      "approved",
      "rejected",
    ],
  })
    .notNull()
    .default("draft"),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewComment: text("review_comment"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const memoRuns = sqliteTable("memo_runs", {
  id: id(),
  memoId: text("memo_id")
    .notNull()
    .references(() => memos.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["running", "completed", "failed"],
  })
    .notNull()
    .default("running"),
  houseViewVersionId: text("house_view_version_id").references(
    () => houseViewVersions.id,
  ),
  areasOfConcernSnapshot: text("areas_of_concern_snapshot"),
  thesisSnapshot: text("thesis_snapshot").notNull(),
  synthesizedMemoJson: text("synthesized_memo_json"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

export const auditEntries = sqliteTable("audit_entries", {
  id: id(),
  memoRunId: text("memo_run_id")
    .notNull()
    .references(() => memoRuns.id, { onDelete: "cascade" }),
  agentName: text("agent_name", {
    enum: ["bull_advocate", "bear_advocate", "house_view_checker", "synthesizer"],
  }).notNull(),
  model: text("model").notNull(),
  promptJson: text("prompt_json").notNull(),
  rawOutput: text("raw_output").notNull(),
  valyuResponsesJson: text("valyu_responses_json"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at"),
});

export const funds = sqliteTable("funds", {
  id: id(),
  type: text("type", { enum: ["mf", "pms", "aif"] }).notNull(),
  name: text("name").notNull(),
  schemeCode: text("scheme_code"),
  fundManager: text("fund_manager"),
  aumNative: integer("aum_native"),
  currency: text("currency").default("USD"),
  asOfDate: integer("as_of_date", { mode: "timestamp_ms" }),
  notes: text("notes"),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const fundHoldings = sqliteTable("fund_holdings", {
  id: id(),
  fundId: text("fund_id")
    .notNull()
    .references(() => funds.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  weightPct: integer("weight_pct_x100").notNull(),
  valueNative: integer("value_native"),
  sector: text("sector"),
  asOfDate: integer("as_of_date", { mode: "timestamp_ms" }),
  createdAt: timestamp("created_at"),
});

export const issuerGroups = sqliteTable("issuer_groups", {
  id: id(),
  name: text("name").notNull().unique(),
  notes: text("notes"),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const issuerGroupMembers = sqliteTable("issuer_group_members", {
  id: id(),
  groupId: text("group_id")
    .notNull()
    .references(() => issuerGroups.id, { onDelete: "cascade" }),
  ticker: text("ticker").notNull(),
  createdAt: timestamp("created_at"),
});

// ============================================================================
// CRITIC ENGINE — Devil's Advocate as the AI CIO reviewer
// ============================================================================

/**
 * Each review is a single pass of the Critic engine over a memo at a specific
 * version. Resubmits create new reviews. The decision drives memo.status.
 */
export const reviews = sqliteTable("reviews", {
  id: id(),
  memoId: text("memo_id")
    .notNull()
    .references(() => memos.id, { onDelete: "cascade" }),
  memoVersion: integer("memo_version").notNull().default(1),
  status: text("status", { enum: ["running", "completed", "failed"] })
    .notNull()
    .default("running"),
  decision: text("decision", {
    enum: ["approved", "changes_requested", "rejected"],
  }),
  confidence: integer("confidence_x100"),
  summary: text("summary"),
  // Reproducibility envelope — frozen at the moment of review
  engineVersion: text("engine_version").notNull(),
  engineModel: text("engine_model").notNull(),
  promptHash: text("prompt_hash").notNull(),
  rulesetHash: text("ruleset_hash").notNull(),
  houseViewVersionId: text("house_view_version_id").references(
    () => houseViewVersions.id,
  ),
  // Pointer to the underlying memo run (the agent execution)
  memoRunId: text("memo_run_id").references(() => memoRuns.id, {
    onDelete: "set null",
  }),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
});

/**
 * Each objection is a flagged item on a memo. Anchors point back to a section
 * (and optionally a quoted excerpt) so the UI can highlight inline.
 */
export const objections = sqliteTable("objections", {
  id: id(),
  reviewId: text("review_id")
    .notNull()
    .references(() => reviews.id, { onDelete: "cascade" }),
  ruleId: text("rule_id").references(() => criticRules.id, {
    onDelete: "set null",
  }),
  type: text("type", {
    enum: [
      "house_view_violation",
      "data_contradiction",
      "unsupported_claim",
      "consensus_divergence",
      "private_peer_threat",
      "macro_risk",
      "thesis_incoherence",
      "blind_spot",
    ],
  }).notNull(),
  severity: text("severity", {
    enum: ["BLOCKING", "MAJOR", "MINOR", "INFO"],
  }).notNull(),
  anchorSection: text("anchor_section").notNull(), // e.g. "thesis", "areas_of_concern"
  anchorExcerpt: text("anchor_excerpt"), // short quoted text from the memo
  title: text("title").notNull(),
  body: text("body").notNull(),
  recommendation: text("recommendation"),
  evidenceJson: text("evidence_json").notNull().default("[]"),
  status: text("status", {
    enum: ["open", "resolved", "disputed", "wontfix"],
  })
    .notNull()
    .default("open"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

/**
 * Discussion thread on a single objection. The engine's initial finding lives
 * on the objection itself; this table holds the back-and-forth.
 */
export const objectionThreads = sqliteTable("objection_threads", {
  id: id(),
  objectionId: text("objection_id")
    .notNull()
    .references(() => objections.id, { onDelete: "cascade" }),
  authorKind: text("author_kind", { enum: ["engine", "fund_manager"] }).notNull(),
  authorUserId: text("author_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  kind: text("kind", {
    enum: ["dispute", "reassertion", "resolution_note", "wontfix_note"],
  }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at"),
});

/**
 * The rules the Critic engine enforces. Built-in rules ship with the app and
 * have source = "builtin" or "house_view". Users add their own with source =
 * "custom" via the Settings UI.
 */
export const criticRules = sqliteTable("critic_rules", {
  id: id(),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  severity: text("severity", { enum: ["HARD", "SOFT"] }).notNull(),
  source: text("source", {
    enum: ["house_view", "builtin", "custom"],
  }).notNull(),
  evaluatorKind: text("evaluator_kind", { enum: ["code", "ai"] }).notNull(),
  evaluatorConfig: text("evaluator_config").notNull().default("{}"),
  rationaleTemplate: text("rationale_template"),
  scope: text("scope", { enum: ["stock", "fund", "both"] })
    .notNull()
    .default("both"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Memo = typeof memos.$inferSelect;
export type NewMemo = typeof memos.$inferInsert;
export type MemoRun = typeof memoRuns.$inferSelect;
export type NewMemoRun = typeof memoRuns.$inferInsert;
export type AuditEntry = typeof auditEntries.$inferSelect;
export type NewAuditEntry = typeof auditEntries.$inferInsert;
export type HouseViewVersion = typeof houseViewVersions.$inferSelect;
export type NewHouseViewVersion = typeof houseViewVersions.$inferInsert;
export type Fund = typeof funds.$inferSelect;
export type NewFund = typeof funds.$inferInsert;
export type FundHolding = typeof fundHoldings.$inferSelect;
export type NewFundHolding = typeof fundHoldings.$inferInsert;
export type IssuerGroup = typeof issuerGroups.$inferSelect;
export type NewIssuerGroup = typeof issuerGroups.$inferInsert;
export type IssuerGroupMember = typeof issuerGroupMembers.$inferSelect;
export type NewIssuerGroupMember = typeof issuerGroupMembers.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
export type Objection = typeof objections.$inferSelect;
export type NewObjection = typeof objections.$inferInsert;
export type ObjectionThread = typeof objectionThreads.$inferSelect;
export type NewObjectionThread = typeof objectionThreads.$inferInsert;
export type CriticRule = typeof criticRules.$inferSelect;
export type NewCriticRule = typeof criticRules.$inferInsert;
