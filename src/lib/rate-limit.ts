/**
 * In-memory sliding-window rate limiter.
 *
 * Module-level Map survives across requests within the same Node worker.
 * For a single-instance Railway service this is sufficient — if you ever
 * scale to multiple replicas, swap the backing store for Upstash Redis
 * or similar. The contract (`check()`) stays identical.
 *
 * Each entry holds the timestamps of recent hits for a key. On each call
 * we drop hits older than `windowMs` and reject if the remaining count
 * exceeds `max`. Memory is bounded by periodically pruning stale keys.
 */

type Entry = { hits: number[] };

const STORE = new Map<string, Entry>();
let lastPrune = Date.now();
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // every 5 min

function pruneIfNeeded(now: number, windowMs: number) {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  for (const [key, entry] of STORE) {
    if (entry.hits.length === 0 || now - entry.hits[entry.hits.length - 1] > windowMs) {
      STORE.delete(key);
    }
  }
  lastPrune = now;
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  pruneIfNeeded(now, windowMs);
  const entry = STORE.get(key) ?? { hits: [] };
  // Drop hits outside the window.
  const cutoff = now - windowMs;
  entry.hits = entry.hits.filter((t) => t > cutoff);
  if (entry.hits.length >= max) {
    STORE.set(key, entry);
    const oldest = entry.hits[0];
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: Math.max(1, oldest + windowMs - now),
    };
  }
  entry.hits.push(now);
  STORE.set(key, entry);
  return {
    ok: true,
    remaining: max - entry.hits.length,
    retryAfterMs: 0,
  };
}
