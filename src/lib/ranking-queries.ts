import "server-only";
import { and, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { db } from "@/db";
import { immersionSessions, user, type MediaType } from "@/db/schema";
import { levelFromSeconds, type LevelInfo } from "./progression";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  /**
   * Assumed non-null: every row here already passed the `publicProfile` filter below,
   * and every user gets a username at signup or via the one-off backfill (see
   * src/lib/username.ts) — there's no ongoing state where a listed user lacks one.
   */
  username: string;
  name: string;
  image: string | null;
  seconds: number;
  sessions: number;
  /** All-time level, regardless of the ranking period. */
  level: LevelInfo;
}

export interface LeaderboardOptions {
  from: Date;
  to: Date;
  /** Restrict to these media types; undefined = everything. */
  types?: MediaType[];
  /** Restrict to these users (e.g. the people you follow); undefined = everyone public. */
  userIds?: string[];
  limit?: number;
}

const sumSeconds = sql<number>`coalesce(sum(${immersionSessions.durationSeconds}), 0)::int`.mapWith(Number);

function rangeWhere({ from, to, types, userIds }: LeaderboardOptions) {
  return and(
    gte(immersionSessions.startedAt, from),
    lt(immersionSessions.startedAt, to),
    types && types.length > 0 ? inArray(immersionSessions.mediaType, types) : undefined,
    userIds ? inArray(immersionSessions.userId, userIds.length > 0 ? userIds : [""]) : undefined,
  );
}

const LEADERBOARD_TTL_SECONDS = 60;

/**
 * The board itself has no viewer-specific data at all (unlike getUserRank, which is
 * anchored to a specific user by construction) — same shared-aggregate-over-
 * immersion_sessions problem as social-queries.ts's listMembers/getCommunityPulse, so
 * it gets the same short-TTL unstable_cache treatment. `from`/`to` here come from
 * presetRange()-style helpers that truncate to day/week/month/year boundaries, so
 * they're already stable across repeated calls within a period — no millisecond-jitter
 * bucketing needed (contrast with social-queries.ts's getCommunityPulse, whose callers
 * sometimes pass a rolling `subDays(new Date(), 7)` instead).
 *
 * When `userIds` is set (the "people you follow" ranking scope), the result is
 * effectively viewer-specific — it's included in the cache key as-is, so different
 * viewers simply get different cache entries rather than sharing one. Still correct,
 * just less of a win than the (far more common) unfiltered board.
 */
async function leaderboardBase(
  fromMs: number,
  toMs: number,
  types: MediaType[] | undefined,
  userIds: string[] | undefined,
  limit: number,
): Promise<LeaderboardRow[]> {
  const opts = { from: new Date(fromMs), to: new Date(toMs), types, userIds };
  const rows = await db
    .select({
      userId: user.id,
      // See LeaderboardRow.username: filtered non-null at the DB level (publicProfile
      // implies a username), so the `string` cast here is safe.
      username: sql<string>`${user.username}`,
      name: user.name,
      image: user.image,
      seconds: sumSeconds,
      sessions: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(immersionSessions)
    .innerJoin(user, eq(immersionSessions.userId, user.id))
    // isDemo: seed-demo.ts's synthetic accounts (safety net independent of `pnpm
    // seed:demo --reset` — see src/db/schema/auth.ts) never show up on the real board.
    .where(and(eq(user.publicProfile, true), eq(user.isDemo, false), rangeWhere(opts)))
    .groupBy(user.id)
    .having(gt(sumSeconds, 0))
    .orderBy(desc(sumSeconds))
    .limit(limit);

  if (rows.length === 0) return [];

  // Levels come from all-time totals, so one more grouped query for just these users.
  const allTime = await db
    .select({ userId: immersionSessions.userId, seconds: sumSeconds })
    .from(immersionSessions)
    .where(inArray(immersionSessions.userId, rows.map((r) => r.userId)))
    .groupBy(immersionSessions.userId);
  const lifetime = new Map(allTime.map((r) => [r.userId, r.seconds]));

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    username: r.username,
    name: r.name,
    image: r.image,
    seconds: r.seconds,
    sessions: r.sessions,
    level: levelFromSeconds(lifetime.get(r.userId) ?? 0),
  }));
}

const cachedLeaderboardBase = unstable_cache(leaderboardBase, ["ranking", "leaderboard"], {
  revalidate: LEADERBOARD_TTL_SECONDS,
});

/** Top users by logged time in a range. Only users with a public profile appear. */
export async function getLeaderboard(opts: LeaderboardOptions): Promise<LeaderboardRow[]> {
  return cachedLeaderboardBase(opts.from.getTime(), opts.to.getTime(), opts.types, opts.userIds, opts.limit ?? 100);
}

export interface UserRank {
  rank: number | null;
  /** Public users with any time logged in the range. */
  total: number;
  seconds: number;
  /** Seconds separating this user from the next rank up (null when #1 or unranked). */
  gapToNext: number | null;
}

/** Where a user stands in a ranking, computed without loading the whole board. */
export async function getUserRank(userId: string, opts: LeaderboardOptions): Promise<UserRank> {
  const [mine] = await db
    .select({ seconds: sumSeconds })
    .from(immersionSessions)
    .where(and(eq(immersionSessions.userId, userId), rangeWhere(opts)));
  const seconds = mine?.seconds ?? 0;

  // Per-user totals among public, non-demo users in range.
  const totals = db
    .select({ userId: user.id, seconds: sumSeconds.as("seconds") })
    .from(immersionSessions)
    .innerJoin(user, eq(immersionSessions.userId, user.id))
    .where(and(eq(user.publicProfile, true), eq(user.isDemo, false), rangeWhere(opts)))
    .groupBy(user.id)
    .as("totals");

  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`.mapWith(Number),
      above: sql<number>`count(*) filter (where ${totals.seconds} > ${seconds})::int`.mapWith(Number),
      next: sql<number | null>`min(${totals.seconds}) filter (where ${totals.seconds} > ${seconds})`.mapWith((v) => (v == null ? null : Number(v))),
    })
    .from(totals);

  const me = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { publicProfile: true, isDemo: true } });
  // A demo account never gets a rank, even signed in as itself — see isDemo above.
  const ranked = seconds > 0 && me?.publicProfile && !me?.isDemo;
  return {
    rank: ranked ? (agg?.above ?? 0) + 1 : null,
    total: agg?.total ?? 0,
    seconds,
    gapToNext: ranked && agg?.next != null ? agg.next - seconds : null,
  };
}

/** Public-profile lookup by handle (the /u/[username] route param); null when the user doesn't exist or opted out. */
export async function getPublicUser(username: string) {
  const u = await db.query.user.findFirst({
    where: eq(user.username, username),
    columns: { id: true, username: true, name: true, image: true, timezone: true, publicProfile: true, createdAt: true },
  });
  return u && u.publicProfile ? u : null;
}
