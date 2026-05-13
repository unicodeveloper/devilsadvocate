import { eq } from "drizzle-orm";
import { db } from "../db";
import { auditEntries, memoRuns, memos } from "../db/schema";
import {
  readHouseView,
  getLatestHouseViewVersion,
  seedHouseViewForUser,
} from "../house-view";
import { getFundById, listHoldingsForFund } from "../funds";
import { fetchSectorDossier } from "../sectors";
import { fetchPrivatePeerDossier, parsePrivatePeers } from "../private-peers";
import { fetchPrivateCompanyResearch } from "../private-company-research";
import { bullAdvocate } from "./bull-advocate";
import { bearAdvocate } from "./bear-advocate";
import { houseViewChecker } from "./house-view-checker";
import { synthesizer } from "./synthesizer";
import { fundBullAdvocate } from "./fund-bull-advocate";
import { fundBearAdvocate } from "./fund-bear-advocate";
import { fundHouseViewChecker } from "./fund-house-view-checker";
import { fundSynthesizer } from "./fund-synthesizer";
import { privateCompanyBullAdvocate } from "./private-company-bull-advocate";
import { privateCompanyBearAdvocate } from "./private-company-bear-advocate";
import {
  privateCompanyHouseViewChecker,
  type StructuredMandate,
} from "./private-company-house-view-checker";
import { privateCompanySynthesizer } from "./private-company-synthesizer";
import type { AgentAudit, ValyuFileAttachment } from "./shared";
import type {
  BearAdvocateOutput,
  BullAdvocateOutput,
  FundBearAdvocateOutput,
  FundBullAdvocateOutput,
  FundHouseViewCheckerOutput,
  FundSynthesizedMemo,
  HouseViewCheckerOutput,
  PrivateCompanyBearAdvocateOutput,
  PrivateCompanyBullAdvocateOutput,
  PrivateCompanyHouseViewCheckerOutput,
  PrivateCompanySynthesizedMemo,
  SynthesizedMemo,
} from "./types";

export type RunInput = {
  memoId: string;
  attachments: ValyuFileAttachment[];
  /**
   * The signed-in user's Valyu OAuth access token, when running in
   * `valyu` app mode. Forwarded to every agent so Valyu calls go through
   * the OAuth proxy and the user's credits are charged. In self-hosted
   * mode this is undefined and agents fall back to `VALYU_API_KEY`.
   */
  accessToken?: string;
};

export type RunEvent =
  | { type: "run_started"; runId: string }
  | { type: "agent_started"; agent: AgentAudit["agentName"] }
  | {
      type: "agent_completed";
      agent: AgentAudit["agentName"];
      durationMs: number;
      output: unknown;
    }
  | { type: "agent_failed"; agent: AgentAudit["agentName"]; error: string }
  | {
      type: "synthesis_completed";
      entityType: "stock" | "fund" | "private_company";
      memo:
        | SynthesizedMemo
        | FundSynthesizedMemo
        | PrivateCompanySynthesizedMemo;
    }
  | { type: "run_completed"; runId: string }
  | { type: "run_failed"; runId: string; error: string };

async function persistAudit(memoRunId: string, audit: AgentAudit) {
  await db.insert(auditEntries).values({
    memoRunId,
    agentName: audit.agentName,
    model: audit.model,
    promptJson: JSON.stringify(audit.promptJson),
    rawOutput: audit.rawOutput,
    valyuResponsesJson: audit.valyuResponsesJson
      ? JSON.stringify(audit.valyuResponsesJson)
      : null,
    durationMs: audit.durationMs,
  });
}

export async function* runStressTest(
  input: RunInput,
): AsyncGenerator<RunEvent, void, unknown> {
  const memoRow = (
    await db.select().from(memos).where(eq(memos.id, input.memoId)).limit(1)
  )[0];
  if (!memoRow) {
    yield { type: "run_failed", runId: "", error: "Memo not found" };
    return;
  }

  // Run against the memo author's House View, not a global one. Seed a copy
  // from the demo FM if the author somehow doesn't have one yet (defensive
  // — sign-in already does this, but old users predating that flow won't).
  let hvVersion = await getLatestHouseViewVersion(memoRow.createdByUserId);
  if (!hvVersion) {
    await seedHouseViewForUser(memoRow.createdByUserId);
    hvVersion = await getLatestHouseViewVersion(memoRow.createdByUserId);
  }
  const hvContent = await readHouseView(memoRow.createdByUserId);

  const [runRow] = await db
    .insert(memoRuns)
    .values({
      memoId: memoRow.id,
      status: "running",
      thesisSnapshot: memoRow.thesis,
      areasOfConcernSnapshot: memoRow.areasOfConcern,
      houseViewVersionId: hvVersion?.id,
    })
    .returning();

  yield { type: "run_started", runId: runRow.id };

  if (memoRow.entityType === "fund") {
    yield* runFundStressTest({
      runId: runRow.id,
      memoRow,
      hvContent,
      attachments: input.attachments,
      accessToken: input.accessToken,
    });
  } else if (memoRow.entityType === "private_company") {
    yield* runPrivateCompanyStressTest({
      runId: runRow.id,
      memoRow,
      hvContent,
      hvVersion,
      attachments: input.attachments,
      accessToken: input.accessToken,
    });
  } else {
    yield* runStockStressTest({
      runId: runRow.id,
      memoRow,
      hvContent,
      attachments: input.attachments,
      accessToken: input.accessToken,
    });
  }
}

type RunSubInput = {
  runId: string;
  memoRow: typeof memos.$inferSelect;
  hvContent: string;
  attachments: ValyuFileAttachment[];
  accessToken?: string;
};

async function* runStockStressTest({
  runId,
  memoRow,
  hvContent,
  attachments,
  accessToken,
}: RunSubInput): AsyncGenerator<RunEvent, void, unknown> {
  if (!memoRow.stockTicker || !memoRow.stockName) {
    yield {
      type: "run_failed",
      runId,
      error: "Stock memo missing ticker or name",
    };
    return;
  }
  const stockCtx = {
    ticker: memoRow.stockTicker,
    name: memoRow.stockName,
    exchange: memoRow.stockExchange,
  };

  // Sector dossier (FDA real API for pharma; Valyu sector-specific queries
  // for the rest) plus a private-peer dossier when the FM named competitors.
  // Both are prepended to the Bear Advocate's research input.
  const peers = parsePrivatePeers(memoRow.privatePeers);
  const [sectorDossier, peerDossier] = await Promise.all([
    fetchSectorDossier(
      {
        ticker: memoRow.stockTicker,
        name: memoRow.stockName,
        sector: memoRow.stockSector,
      },
      undefined,
      accessToken,
    ),
    fetchPrivatePeerDossier(
      peers,
      {
        ticker: memoRow.stockTicker,
        name: memoRow.stockName,
      },
      accessToken,
    ),
  ]);

  let bullOut: BullAdvocateOutput;
  let bearOut: BearAdvocateOutput;
  let houseOut: HouseViewCheckerOutput;

  try {
    yield { type: "agent_started", agent: "bull_advocate" };
    yield { type: "agent_started", agent: "bear_advocate" };
    yield { type: "agent_started", agent: "house_view_checker" };

    const [bullRes, bearRes, houseRes] = await Promise.all([
      bullAdvocate({ stock: stockCtx, thesis: memoRow.thesis, accessToken }),
      bearAdvocate({
        stock: stockCtx,
        thesis: memoRow.thesis,
        areasOfConcern: memoRow.areasOfConcern,
        attachments,
        sectorDossierMarkdown: sectorDossier.dossierMarkdown || null,
        privatePeerDossierMarkdown: peerDossier.dossierMarkdown || null,
        accessToken,
      }),
      houseViewChecker({
        stock: stockCtx,
        thesis: memoRow.thesis,
        houseViewMarkdown: hvContent,
      }),
    ]);

    bullOut = bullRes.output;
    bearOut = bearRes.output;
    houseOut = houseRes.output;

    await persistAudit(runId, bullRes.audit);
    await persistAudit(runId, bearRes.audit);
    await persistAudit(runId, houseRes.audit);

    yield {
      type: "agent_completed",
      agent: "bull_advocate",
      durationMs: bullRes.audit.durationMs,
      output: bullOut,
    };
    yield {
      type: "agent_completed",
      agent: "bear_advocate",
      durationMs: bearRes.audit.durationMs,
      output: bearOut,
    };
    yield {
      type: "agent_completed",
      agent: "house_view_checker",
      durationMs: houseRes.audit.durationMs,
      output: houseOut,
    };
  } catch (err) {
    yield* failRun(runId, err);
    return;
  }

  try {
    yield { type: "agent_started", agent: "synthesizer" };
    const synthRes = await synthesizer({
      stock: stockCtx,
      thesis: memoRow.thesis,
      bull: bullOut,
      bear: bearOut,
      houseView: houseOut,
    });
    await persistAudit(runId, synthRes.audit);

    await db
      .update(memoRuns)
      .set({
        status: "completed",
        synthesizedMemoJson: JSON.stringify(synthRes.output),
        finishedAt: new Date(),
      })
      .where(eq(memoRuns.id, runId));

    yield {
      type: "agent_completed",
      agent: "synthesizer",
      durationMs: synthRes.audit.durationMs,
      output: synthRes.output,
    };
    yield {
      type: "synthesis_completed",
      entityType: "stock",
      memo: synthRes.output,
    };
    yield { type: "run_completed", runId };
  } catch (err) {
    yield* failRun(runId, err);
  }
}

async function* runFundStressTest({
  runId,
  memoRow,
  hvContent,
  attachments,
  accessToken,
}: RunSubInput): AsyncGenerator<RunEvent, void, unknown> {
  if (!memoRow.fundId) {
    yield { type: "run_failed", runId, error: "Fund memo missing fundId" };
    return;
  }

  const fund = await getFundById(memoRow.fundId);
  if (!fund) {
    yield { type: "run_failed", runId, error: "Linked fund no longer exists" };
    return;
  }
  const holdingsRows = await listHoldingsForFund(fund.id);
  if (holdingsRows.length === 0) {
    yield {
      type: "run_failed",
      runId,
      error: "Fund has no holdings — upload a CSV before generating a stress-test",
    };
    return;
  }

  const fundCtx = {
    fundId: fund.id,
    fundName: fund.name,
    fundType: fund.type,
    fundManager: fund.fundManager,
    aumNative: fund.aumNative,
    currency: fund.currency,
  };
  const holdingsForAgent = holdingsRows.map((h) => ({
    ticker: h.ticker,
    name: h.name,
    weightPct: h.weightPct / 100,
    sector: h.sector,
    valueNative: h.valueNative,
  }));

  let bullOut: FundBullAdvocateOutput;
  let bearOut: FundBearAdvocateOutput;
  let houseOut: FundHouseViewCheckerOutput;

  try {
    yield { type: "agent_started", agent: "bull_advocate" };
    yield { type: "agent_started", agent: "bear_advocate" };
    yield { type: "agent_started", agent: "house_view_checker" };

    const [bullRes, bearRes, houseRes] = await Promise.all([
      fundBullAdvocate({
        fund: fundCtx,
        thesis: memoRow.thesis,
        holdings: holdingsForAgent,
        accessToken,
      }),
      fundBearAdvocate({
        fund: fundCtx,
        thesis: memoRow.thesis,
        areasOfConcern: memoRow.areasOfConcern,
        holdings: holdingsForAgent,
        attachments,
        accessToken,
      }),
      fundHouseViewChecker({
        fund: fundCtx,
        thesis: memoRow.thesis,
        holdings: holdingsForAgent,
        houseViewMarkdown: hvContent,
      }),
    ]);

    bullOut = bullRes.output;
    bearOut = bearRes.output;
    houseOut = houseRes.output;

    await persistAudit(runId, bullRes.audit);
    await persistAudit(runId, bearRes.audit);
    await persistAudit(runId, houseRes.audit);

    yield {
      type: "agent_completed",
      agent: "bull_advocate",
      durationMs: bullRes.audit.durationMs,
      output: bullOut,
    };
    yield {
      type: "agent_completed",
      agent: "bear_advocate",
      durationMs: bearRes.audit.durationMs,
      output: bearOut,
    };
    yield {
      type: "agent_completed",
      agent: "house_view_checker",
      durationMs: houseRes.audit.durationMs,
      output: houseOut,
    };
  } catch (err) {
    yield* failRun(runId, err);
    return;
  }

  try {
    yield { type: "agent_started", agent: "synthesizer" };
    const synthRes = await fundSynthesizer({
      fund: fundCtx,
      thesis: memoRow.thesis,
      holdings: holdingsForAgent,
      bull: bullOut,
      bear: bearOut,
      houseView: houseOut,
    });
    await persistAudit(runId, synthRes.audit);

    await db
      .update(memoRuns)
      .set({
        status: "completed",
        synthesizedMemoJson: JSON.stringify(synthRes.output),
        finishedAt: new Date(),
      })
      .where(eq(memoRuns.id, runId));

    yield {
      type: "agent_completed",
      agent: "synthesizer",
      durationMs: synthRes.audit.durationMs,
      output: synthRes.output,
    };
    yield {
      type: "synthesis_completed",
      entityType: "fund",
      memo: synthRes.output,
    };
    yield { type: "run_completed", runId };
  } catch (err) {
    yield* failRun(runId, err);
  }
}

type RunPrivateCompanyInput = RunSubInput & {
  /**
   * Resolved HV version row — used to pull the structured private-co
   * mandate fields. May be null if seeding failed; the run still works,
   * just without mechanical mandate enforcement.
   */
  hvVersion: Awaited<ReturnType<typeof getLatestHouseViewVersion>>;
};

async function* runPrivateCompanyStressTest({
  runId,
  memoRow,
  hvContent,
  hvVersion,
  accessToken,
}: RunPrivateCompanyInput): AsyncGenerator<RunEvent, void, unknown> {
  if (
    !memoRow.privateCompanyName ||
    !memoRow.privateCompanyUrl ||
    !memoRow.privateCompanyRoundStage
  ) {
    yield {
      type: "run_failed",
      runId,
      error: "Private-company memo missing required fields (name, url, stage)",
    };
    return;
  }

  const founders = parseFoundersJson(memoRow.privateCompanyFoundersJson);
  if (founders.length === 0) {
    yield {
      type: "run_failed",
      runId,
      error: "Private-company memo missing founder names",
    };
    return;
  }

  const companyCtx = {
    name: memoRow.privateCompanyName,
    url: memoRow.privateCompanyUrl,
    founders,
    roundStage: memoRow.privateCompanyRoundStage,
    sector: memoRow.privateCompanySector,
    geo: memoRow.privateCompanyGeo,
    checkSizeUsd: memoRow.privateCompanyCheckSizeUsd,
    postMoneyUsd: memoRow.privateCompanyPostMoneyUsd,
  };

  const structuredMandate: StructuredMandate = {
    checkSizeMinUsd: hvVersion?.privateCheckSizeMinUsd ?? null,
    checkSizeMaxUsd: hvVersion?.privateCheckSizeMaxUsd ?? null,
    stageAllowlist: parseJsonArray(hvVersion?.privateStageAllowlistJson),
    sectorAllowlist: parseJsonArray(hvVersion?.privateSectorAllowlistJson),
    sectorBlocklist: parseJsonArray(hvVersion?.privateSectorBlocklistJson),
    geoAllowlist: parseJsonArray(hvVersion?.privateGeoAllowlistJson),
  };

  // Dossier is upstream of every agent — failure here stalls the run, so
  // surface the error rather than silently producing low-signal output.
  let research;
  try {
    research = await fetchPrivateCompanyResearch(companyCtx, accessToken);
  } catch (err) {
    yield* failRun(runId, err);
    return;
  }

  let bullOut: PrivateCompanyBullAdvocateOutput;
  let bearOut: PrivateCompanyBearAdvocateOutput;
  let houseOut: PrivateCompanyHouseViewCheckerOutput;

  try {
    yield { type: "agent_started", agent: "bull_advocate" };
    yield { type: "agent_started", agent: "bear_advocate" };
    yield { type: "agent_started", agent: "house_view_checker" };

    const [bullRes, bearRes, houseRes] = await Promise.all([
      privateCompanyBullAdvocate({
        company: companyCtx,
        thesis: memoRow.thesis,
        research,
        accessToken,
      }),
      privateCompanyBearAdvocate({
        company: companyCtx,
        thesis: memoRow.thesis,
        areasOfConcern: memoRow.areasOfConcern,
        research,
        accessToken,
      }),
      privateCompanyHouseViewChecker({
        company: {
          name: companyCtx.name,
          roundStage: companyCtx.roundStage,
          sector: companyCtx.sector,
          geo: companyCtx.geo,
          checkSizeUsd: companyCtx.checkSizeUsd,
        },
        thesis: memoRow.thesis,
        houseViewMarkdown: hvContent,
        structuredMandate,
      }),
    ]);

    bullOut = bullRes.output;
    bearOut = bearRes.output;
    houseOut = houseRes.output;

    await persistAudit(runId, bullRes.audit);
    await persistAudit(runId, bearRes.audit);
    await persistAudit(runId, houseRes.audit);

    yield {
      type: "agent_completed",
      agent: "bull_advocate",
      durationMs: bullRes.audit.durationMs,
      output: bullOut,
    };
    yield {
      type: "agent_completed",
      agent: "bear_advocate",
      durationMs: bearRes.audit.durationMs,
      output: bearOut,
    };
    yield {
      type: "agent_completed",
      agent: "house_view_checker",
      durationMs: houseRes.audit.durationMs,
      output: houseOut,
    };
  } catch (err) {
    yield* failRun(runId, err);
    return;
  }

  try {
    yield { type: "agent_started", agent: "synthesizer" };
    const synthRes = await privateCompanySynthesizer({
      company: companyCtx,
      thesis: memoRow.thesis,
      bull: bullOut,
      bear: bearOut,
      houseView: houseOut,
    });
    await persistAudit(runId, synthRes.audit);

    await db
      .update(memoRuns)
      .set({
        status: "completed",
        synthesizedMemoJson: JSON.stringify(synthRes.output),
        finishedAt: new Date(),
      })
      .where(eq(memoRuns.id, runId));

    yield {
      type: "agent_completed",
      agent: "synthesizer",
      durationMs: synthRes.audit.durationMs,
      output: synthRes.output,
    };
    yield {
      type: "synthesis_completed",
      entityType: "private_company",
      memo: synthRes.output,
    };
    yield { type: "run_completed", runId };
  } catch (err) {
    yield* failRun(runId, err);
  }
}

function parseFoundersJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function parseJsonArray(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const cleaned = parsed
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

async function* failRun(
  runId: string,
  err: unknown,
): AsyncGenerator<RunEvent, void, unknown> {
  const message = err instanceof Error ? err.message : String(err);
  await db
    .update(memoRuns)
    .set({
      status: "failed",
      errorMessage: message,
      finishedAt: new Date(),
    })
    .where(eq(memoRuns.id, runId));
  yield { type: "run_failed", runId, error: message };
}

export function eventsToNdjsonStream(
  events: AsyncGenerator<RunEvent, void, unknown>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "run_failed",
              runId: "",
              error: message,
            }) + "\n",
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}
