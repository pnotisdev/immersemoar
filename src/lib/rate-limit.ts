import "server-only";

interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the caller's oldest hit in the window ages out. 0 when allowed. */
  retryAfterMs: number;
}

/**
 * A per-process, in-memory sliding-window rate limiter. There's no Redis or other
 * shared store available, so under a multi-worker deployment (PM2 cluster, etc.) each
 * worker enforces its own independent window — the effective ceiling per key is closer
 * to `limit * workerCount` per `windowMs` than a single global number. That's a known,
 * accepted trade for a pragmatic fix with no new infrastructure: it still turns
 * "unlimited" into "bounded," just not perfectly.
 *
 * Memory is bounded per key (each key holds at most `limit` timestamps), but the map
 * itself grows with the number of distinct keys ever seen and is never swept. Fine at
 * this app's scale (a few thousand users at most); not something to reuse as-is for a
 * high-cardinality key space.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, number[]>();

  return function check(key: string): RateLimitResult {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
      hits.set(key, recent);
      return { allowed: false, retryAfterMs: windowMs - (now - recent[0]) };
    }

    recent.push(now);
    hits.set(key, recent);
    return { allowed: true, retryAfterMs: 0 };
  };
}
