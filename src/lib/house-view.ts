import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { houseViewVersions, users } from "./db/schema";

/**
 * Default content used to seed a House View when nothing better exists
 * (no seed FM, or seed FM has no House View yet). New users normally get a
 * copy of the seed FM's current House View, not this placeholder.
 */
const PLACEHOLDER = `# House View

The firm-wide one-pager. Edited by the Fund Manager. Devil's Advocate treats this as
the **source of truth** — when broker reports or peer signals contradict it,
the engine flags the divergence rather than overriding.

## Investment Framework

- **Quality bias.** We prefer companies with ROE > 15% sustained over 3+ years.
- **No high debt.** Net debt / EBITDA must be < 2.5x.
- **Reasonable price.** PEG ratio under 1.5 across the portfolio.
- **Cash-flow grounded.** FCF positive in 4 of last 5 years.

## House Calls (current)

> Update these as the IC takes positions. The Synthesizer will surface
> divergence between these and broker / peer / macro signals.

- **Auto:** Constructive on premium and EV-exposed names; cautious on entry-level
  ICE due to BEV penetration risk.
- **Banks:** Overweight private banks; underweight PSU on credit-cost concerns.
- **IT services:** Neutral; waiting for US discretionary spend recovery.

## Hard Rules (non-negotiable)

- No exposure to companies with active SEBI / SEC enforcement actions.
- No single-stock concentration above 8% of portfolio.
- No leverage above 1.2x at the fund level.
`;

/**
 * Returns the live House View content for the given user. Falls back to the
 * seed FM's House View (so unauthed visitors and pre-onboarding states see
 * something) and then to the placeholder if even that doesn't exist.
 */
export async function readHouseView(
  ownerUserId?: string | null,
): Promise<string> {
  if (ownerUserId) {
    const own = await getLatestHouseViewVersion(ownerUserId);
    if (own) return own.content;
  }
  const seedOwner = await getSeedHouseViewOwnerId();
  if (seedOwner) {
    const seed = await getLatestHouseViewVersion(seedOwner);
    if (seed) return seed.content;
  }
  return PLACEHOLDER;
}

/**
 * Persists a new version of `ownerUserId`'s House View. The DB is
 * append-only — every save creates an immutable snapshot row, and the most
 * recent row per owner is that owner's effective "current" version.
 *
 * Carries forward the structured private-co mandate fields from the
 * previous version when the caller doesn't provide them — so editing the
 * markdown doesn't blow away the structured mandate, and vice versa.
 */
export async function writeHouseView(
  content: string,
  ownerUserId: string,
  updatedByUserId: string = ownerUserId,
  structuredMandate?: PrivateMandateFields,
): Promise<void> {
  const previous = await getLatestHouseViewVersion(ownerUserId);
  const mandate = structuredMandate ?? extractMandateFromVersion(previous);
  await db.insert(houseViewVersions).values({
    content,
    ownerUserId,
    updatedByUserId,
    privateCheckSizeMinUsd: mandate.checkSizeMinUsd,
    privateCheckSizeMaxUsd: mandate.checkSizeMaxUsd,
    privateStageAllowlistJson: serializeArray(mandate.stageAllowlist),
    privateSectorAllowlistJson: serializeArray(mandate.sectorAllowlist),
    privateSectorBlocklistJson: serializeArray(mandate.sectorBlocklist),
    privateGeoAllowlistJson: serializeArray(mandate.geoAllowlist),
  });
}

/**
 * Save just the structured private-company mandate fields. Creates a new
 * version row that carries the current markdown forward — keeps the
 * version log honest (one row per change, regardless of which slice the
 * user touched).
 */
export async function writePrivateMandate(
  fields: PrivateMandateFields,
  ownerUserId: string,
  updatedByUserId: string = ownerUserId,
): Promise<void> {
  const previous = await getLatestHouseViewVersion(ownerUserId);
  const content = previous?.content ?? PLACEHOLDER;
  await writeHouseView(content, ownerUserId, updatedByUserId, fields);
}

export type PrivateMandateFields = {
  checkSizeMinUsd: number | null;
  checkSizeMaxUsd: number | null;
  stageAllowlist: string[] | null;
  sectorAllowlist: string[] | null;
  sectorBlocklist: string[] | null;
  geoAllowlist: string[] | null;
};

const EMPTY_MANDATE: PrivateMandateFields = {
  checkSizeMinUsd: null,
  checkSizeMaxUsd: null,
  stageAllowlist: null,
  sectorAllowlist: null,
  sectorBlocklist: null,
  geoAllowlist: null,
};

/**
 * Read the most recent structured private-co mandate for a user. Falls
 * back to `EMPTY_MANDATE` if the user has no House View row yet.
 */
export async function readPrivateMandate(
  ownerUserId: string,
): Promise<PrivateMandateFields> {
  const row = await getLatestHouseViewVersion(ownerUserId);
  return extractMandateFromVersion(row);
}

function extractMandateFromVersion(
  row: Awaited<ReturnType<typeof getLatestHouseViewVersion>>,
): PrivateMandateFields {
  if (!row) return EMPTY_MANDATE;
  return {
    checkSizeMinUsd: row.privateCheckSizeMinUsd ?? null,
    checkSizeMaxUsd: row.privateCheckSizeMaxUsd ?? null,
    stageAllowlist: parseArray(row.privateStageAllowlistJson),
    sectorAllowlist: parseArray(row.privateSectorAllowlistJson),
    sectorBlocklist: parseArray(row.privateSectorBlocklistJson),
    geoAllowlist: parseArray(row.privateGeoAllowlistJson),
  };
}

function parseArray(raw: string | null): string[] | null {
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

function serializeArray(arr: string[] | null): string | null {
  if (!arr || arr.length === 0) return null;
  return JSON.stringify(arr);
}

/**
 * Seeds a brand-new FM's House View by copying the seed FM's current
 * version. If the seed FM has no House View yet (or no seed FM exists at
 * all), falls back to the placeholder so the new user always lands on
 * something they can edit. Idempotent — does nothing if the user already
 * has at least one version.
 */
export async function seedHouseViewForUser(
  newUserId: string,
): Promise<"seeded" | "skipped"> {
  const own = await getLatestHouseViewVersion(newUserId);
  if (own) return "skipped";

  const seedOwner = await getSeedHouseViewOwnerId();
  let content = PLACEHOLDER;
  if (seedOwner) {
    const seed = await getLatestHouseViewVersion(seedOwner);
    if (seed) content = seed.content;
  }
  await db.insert(houseViewVersions).values({
    content,
    ownerUserId: newUserId,
    updatedByUserId: newUserId,
  });
  return "seeded";
}

/**
 * Initial seed used by the database seed script — creates the demo FM's
 * House View if they don't already have one. The placeholder is the source
 * of truth here so we never depend on another user's data.
 */
export async function seedDemoHouseViewIfEmpty(
  demoUserId: string,
): Promise<"seeded" | "skipped"> {
  const latest = await getLatestHouseViewVersion(demoUserId);
  if (latest) return "skipped";
  await db.insert(houseViewVersions).values({
    content: PLACEHOLDER,
    ownerUserId: demoUserId,
    updatedByUserId: demoUserId,
  });
  return "seeded";
}

export async function getLatestHouseViewVersion(ownerUserId: string) {
  const rows = await db
    .select()
    .from(houseViewVersions)
    .where(eq(houseViewVersions.ownerUserId, ownerUserId))
    .orderBy(desc(houseViewVersions.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getHouseViewVersionById(id: string) {
  const rows = await db
    .select()
    .from(houseViewVersions)
    .where(eq(houseViewVersions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export type HouseViewVersionWithAuthor = {
  id: string;
  content: string;
  createdAt: Date;
  authorName: string | null;
  authorEmail: string | null;
};

export async function listHouseViewVersions(
  ownerUserId: string,
  limit = 25,
): Promise<HouseViewVersionWithAuthor[]> {
  const rows = await db
    .select({
      id: houseViewVersions.id,
      content: houseViewVersions.content,
      createdAt: houseViewVersions.createdAt,
      authorName: users.name,
      authorEmail: users.email,
    })
    .from(houseViewVersions)
    .leftJoin(users, eq(users.id, houseViewVersions.updatedByUserId))
    .where(eq(houseViewVersions.ownerUserId, ownerUserId))
    .orderBy(desc(houseViewVersions.createdAt))
    .limit(limit);
  return rows;
}

export async function countHouseViewVersions(
  ownerUserId: string,
): Promise<number> {
  const rows = await db
    .select()
    .from(houseViewVersions)
    .where(eq(houseViewVersions.ownerUserId, ownerUserId));
  return rows.length;
}

/**
 * Returns the seed FM's user id, or null if the seed user doesn't exist.
 * Used for read-only views shown to unauthed visitors and as the source
 * material when seeding a new FM's House View.
 */
export async function getSeedHouseViewOwnerId(): Promise<string | null> {
  const seedEmail = process.env.SEED_FM_EMAIL ?? "demo@devilsadvocate.local";
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, seedEmail))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Convenience: load a specific version, scoped to the expected owner.
 * Use this when displaying history items so a crafted id can't reveal
 * another user's content.
 */
export async function getOwnedHouseViewVersion(
  id: string,
  ownerUserId: string,
) {
  const rows = await db
    .select()
    .from(houseViewVersions)
    .where(
      and(
        eq(houseViewVersions.id, id),
        eq(houseViewVersions.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
