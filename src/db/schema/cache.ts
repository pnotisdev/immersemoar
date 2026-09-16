import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A small generic key-value cache, shared by every app process (PM2 cluster workers,
 * etc). There's no Redis or other shared-memory store available, so Postgres — the one
 * resource every process already connects to — stands in for it. Not for hot-path,
 * high-frequency data: every read/write is a query against the primary database. See
 * src/lib/cache-store.ts for the read/write helpers and TTL handling.
 *
 * First consumer: src/lib/sources/browse.ts (Discover shelves), so every worker shares
 * one AniList/VNDB fetch per hour instead of one each.
 */
export const cacheEntries = pgTable("cache_entries", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().$type<unknown>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
