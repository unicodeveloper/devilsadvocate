import { desc, eq } from "drizzle-orm";
import { db } from "./db";
import { houseViewVersions, users } from "./db/schema";

/**
 * Default content used to seed the very first house-view version on a fresh
 * database. After that, the DB is the only source of truth — every UI save
 * inserts a new row and the latest row is "the current house view".
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
 * Returns the live house view. Always reads the latest version from the
 * `house_view_versions` table; falls back to the placeholder only if the
 * table is completely empty (which should not happen after seeding).
 */
export async function readHouseView(): Promise<string> {
  const latest = await getLatestHouseViewVersion();
  return latest?.content ?? PLACEHOLDER;
}

/**
 * Persists a new version of the house view. The DB is append-only — every
 * save creates an immutable snapshot row, and the most recent row is the
 * effective "current" version.
 */
export async function writeHouseView(
  content: string,
  updatedByUserId: string,
): Promise<void> {
  await db.insert(houseViewVersions).values({ content, updatedByUserId });
}

/**
 * Seeds the very first version when no row exists. Idempotent — safe to call
 * on every boot. Used by the seed script after the seed user is created.
 */
export async function seedHouseViewIfEmpty(
  userId: string,
): Promise<"seeded" | "skipped"> {
  const latest = await getLatestHouseViewVersion();
  if (latest) return "skipped";
  await db.insert(houseViewVersions).values({
    content: PLACEHOLDER,
    updatedByUserId: userId,
  });
  return "seeded";
}

export async function getLatestHouseViewVersion() {
  const rows = await db
    .select()
    .from(houseViewVersions)
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
    .orderBy(desc(houseViewVersions.createdAt))
    .limit(limit);
  return rows;
}

export async function countHouseViewVersions(): Promise<number> {
  const rows = await db.select().from(houseViewVersions);
  return rows.length;
}
