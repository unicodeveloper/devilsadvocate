import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health endpoint — verifies the DB is reachable, not just that the Node
 * process is responding. Railway's load balancer + uptime monitors should
 * point here. Returns 200 only when both the process is up AND a trivial
 * SELECT against the SQLite volume succeeds.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    // Cheap pulse against the DB. Fails fast if the volume is detached
    // or the file is corrupted.
    await db.run(sql`SELECT 1`);
    return Response.json({
      ok: true,
      db: "ok",
      latencyMs: Date.now() - startedAt,
      ts: Date.now(),
    });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        db: "fail",
        error: e instanceof Error ? e.message : "unknown",
        latencyMs: Date.now() - startedAt,
        ts: Date.now(),
      },
      { status: 503 },
    );
  }
}
