import "server-only";
import { and, desc, eq, gt, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { immersionSessions, user, type MediaType } from "@/db/schema";
import { levelFromSeconds, type LevelInfo } from "./progression";

export interface LeaderboardRow {
  rank: number;
  userId: string;
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
  limit?: number;
}

const sumSeconds = sql<number>`coalesce(sum(${immersionSessions.durationSeconds}), 0)::int`.mapWith(Number);

function rangeWhere({ from, to, types }: LeaderboardOptions) {
  return and(
    gte(immersionSessions.startedAt, from),
    lt(immersionSessions.startedAt, to),
    types && types.length > 0 ? inArray(immersionSessions.mediaType, types) : undefined,
  );
}

/** Top users by logged time in a range. Only users with a public profile appear. */
export async function getLeaderboard(opts: LeaderboardOptions): Promise<LeaderboardRow[]> {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      seconds: sumSeconds,
      sessions: sql<number>`count(*)::int`.mapWith(Number),
    })
    .from(immersionSessions)
    .innerJoin(user, eq(immersionSessions.userId, user.id))
    .where(and(eq(user.publicProfile, true), rangeWhere(opts)))
    .groupBy(user.id)
    .having(gt(sumSeconds, 0))
    .orderBy(desc(sumSeconds))
    .limit(opts.limit ?? 100);

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
    name: r.name,
    image: r.image,
    seconds: r.seconds,
    sessions: r.sessions,
    level: levelFromSeconds(lifetime.get(r.userId) ?? 0),
  }));
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

  // Per-user totals among public users in range.
  const totals = db
    .select({ userId: user.id, seconds: sumSeconds.as("seconds") })
    .from(immersionSessions)
    .innerJoin(user, eq(immersionSessions.userId, user.id))
    .where(and(eq(user.publicProfile, true), rangeWhere(opts)))
    .groupBy(user.id)
    .as("totals");

  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`.mapWith(Number),
      above: sql<number>`count(*) filter (where ${totals.seconds} > ${seconds})::int`.mapWith(Number),
      next: sql<number | null>`min(${totals.seconds}) filter (where ${totals.seconds} > ${seconds})`.mapWith((v) => (v == null ? null : Number(v))),
    })
    .from(totals);

  const me = await db.query.user.findFirst({ where: eq(user.id, userId), columns: { publicProfile: true } });
  const ranked = seconds > 0 && me?.publicProfile;
  return {
    rank: ranked ? (agg?.above ?? 0) + 1 : null,
    total: agg?.total ?? 0,
    seconds,
    gapToNext: ranked && agg?.next != null ? agg.next - seconds : null,
  };
}

/** Public-profile lookup; null when the user doesn't exist or opted out. */
export async function getPublicUser(id: string) {
  const u = await db.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true, name: true, image: true, timezone: true, publicProfile: true, createdAt: true },
  });
  return u && u.publicProfile ? u : null;
}
