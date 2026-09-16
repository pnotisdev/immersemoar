import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cacheEntries } from "@/db/schema";

/**
 * A small Postgres-backed cache for values that need to be shared across every app
 * process (see src/db/schema/cache.ts for why Postgres, specifically). Values must be
 * JSON-serializable (stored in a jsonb column).
 *
 * This is not a fetch-scoped or request-scoped cache — it's a plain table, so callers
 * own their own TTL policy (pass the same `maxAgeMs` you used to decide freshness) and
 * their own "don't cache a failure" behavior (simply don't call `cacheSet` on failure).
 */

/** Returns the cached value for `key`, or undefined if missing or older than `maxAgeMs`. */
export async function cacheGet<T>(key: string, maxAgeMs: number): Promise<T | undefined> {
  const rows = await db.select().from(cacheEntries).where(eq(cacheEntries.key, key)).limit(1);
  const row = rows[0];
  if (!row) return undefined;
  if (Date.now() - row.updatedAt.getTime() > maxAgeMs) return undefined;
  return row.value as T;
}

/** Upserts `value` under `key`, stamped with the current time. */
export async function cacheSet(key: string, value: unknown): Promise<void> {
  await db
    .insert(cacheEntries)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: cacheEntries.key, set: { value, updatedAt: new Date() } });
}
