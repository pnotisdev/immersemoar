import "server-only";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activeTimers,
  goals,
  immersionSessions,
  libraryEntries,
  mediaItems,
  type EntryStatus,
  type MediaType,
} from "@/db/schema";
import { dayEnd, dayStart } from "./dates";

// --- Timer ---

export async function getActiveTimer(userId: string) {
  return db.query.activeTimers.findFirst({
    where: eq(activeTimers.userId, userId),
    with: { mediaItem: true },
  });
}

// --- Sessions ---

export type SessionWithItem = Awaited<ReturnType<typeof getSessionsInRange>>[number];

export async function getSessionsInRange(userId: string, from: Date, to: Date, limit?: number) {
  return db.query.immersionSessions.findMany({
    where: and(
      eq(immersionSessions.userId, userId),
      gte(immersionSessions.startedAt, from),
      lt(immersionSessions.startedAt, to),
    ),
    with: { mediaItem: true },
    orderBy: [desc(immersionSessions.startedAt)],
    limit,
  });
}

export async function getRecentSessions(userId: string, limit = 10) {
  return db.query.immersionSessions.findMany({
    where: eq(immersionSessions.userId, userId),
    with: { mediaItem: true },
    orderBy: [desc(immersionSessions.startedAt)],
    limit,
  });
}

export async function getSessionById(userId: string, id: string) {
  return db.query.immersionSessions.findFirst({
    where: and(eq(immersionSessions.id, id), eq(immersionSessions.userId, userId)),
    with: { mediaItem: true },
  });
}

const sumSeconds = sql<number>`coalesce(sum(${immersionSessions.durationSeconds}), 0)::int`.mapWith(Number);
const countRows = sql<number>`count(*)::int`.mapWith(Number);

export async function sumDuration(userId: string, from: Date, to: Date, mediaType?: MediaType | null) {
  const [row] = await db
    .select({ seconds: sumSeconds })
    .from(immersionSessions)
    .where(
      and(
        eq(immersionSessions.userId, userId),
        gte(immersionSessions.startedAt, from),
        lt(immersionSessions.startedAt, to),
        mediaType ? eq(immersionSessions.mediaType, mediaType) : undefined,
      ),
    );
  return row?.seconds ?? 0;
}

/** Seconds per day ("YYYY-MM-DD" in the user's tz) within [from, to). Days with no sessions are absent. */
export async function getDailyTotals(userId: string, from: Date, to: Date, tz: string) {
  // Group by the output alias: binding tz as a parameter twice makes Postgres treat the
  // SELECT and GROUP BY expressions as different ($1 vs $5).
  const day = sql<string>`to_char(${immersionSessions.startedAt} at time zone ${tz}, 'YYYY-MM-DD')`.as("day");
  const rows = await db
    .select({ day, seconds: sumSeconds, count: countRows })
    .from(immersionSessions)
    .where(
      and(
        eq(immersionSessions.userId, userId),
        gte(immersionSessions.startedAt, from),
        lt(immersionSessions.startedAt, to),
      ),
    )
    .groupBy(sql`"day"`)
    .orderBy(sql`"day"`);
  return new Map(rows.map((r) => [r.day, { seconds: r.seconds, count: r.count }]));
}

export async function getTypeBreakdown(userId: string, from: Date, to: Date) {
  return db
    .select({
      mediaType: immersionSessions.mediaType,
      seconds: sumSeconds,
      count: countRows,
    })
    .from(immersionSessions)
    .where(
      and(
        eq(immersionSessions.userId, userId),
        gte(immersionSessions.startedAt, from),
        lt(immersionSessions.startedAt, to),
      ),
    )
    .groupBy(immersionSessions.mediaType)
    .orderBy(desc(sumSeconds));
}

export async function getTopItems(userId: string, from: Date, to: Date, limit = 8) {
  return db
    .select({
      mediaItemId: mediaItems.id,
      title: mediaItems.title,
      titleNative: mediaItems.titleNative,
      coverUrl: mediaItems.coverUrl,
      bannerUrl: mediaItems.bannerUrl,
      type: mediaItems.type,
      seconds: sumSeconds,
      count: countRows,
    })
    .from(immersionSessions)
    .innerJoin(mediaItems, eq(immersionSessions.mediaItemId, mediaItems.id))
    .where(
      and(
        eq(immersionSessions.userId, userId),
        gte(immersionSessions.startedAt, from),
        lt(immersionSessions.startedAt, to),
      ),
    )
    .groupBy(mediaItems.id)
    .orderBy(desc(sumSeconds))
    .limit(limit);
}

export async function getLifetimeStats(userId: string) {
  const [row] = await db
    .select({
      seconds: sumSeconds,
      count: countRows,
      firstSession: sql<string | null>`min(${immersionSessions.startedAt})`,
    })
    .from(immersionSessions)
    .where(eq(immersionSessions.userId, userId));
  return row ?? { seconds: 0, count: 0, firstSession: null };
}

/** Number of consecutive days ending today (or yesterday) with at least one session. */
export function computeStreak(dailyTotals: Map<string, { seconds: number }>, todayKey: string, yesterdayKey: string) {
  const keys = [...dailyTotals.keys()].filter((k) => dailyTotals.get(k)!.seconds > 0).sort();
  if (keys.length === 0) return 0;
  const set = new Set(keys);
  // Streak is alive if there's activity today or yesterday.
  const start = set.has(todayKey) ? todayKey : set.has(yesterdayKey) ? yesterdayKey : null;
  if (!start) return 0;
  let cursor: string = start;
  let streak = 0;
  while (set.has(cursor)) {
    streak++;
    const d = new Date(cursor + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

// --- Library ---

export async function getLibrary(userId: string, status?: EntryStatus, type?: MediaType) {
  const rows = await db.query.libraryEntries.findMany({
    where: and(
      eq(libraryEntries.userId, userId),
      status ? eq(libraryEntries.status, status) : undefined,
    ),
    with: { mediaItem: true },
    orderBy: [desc(libraryEntries.updatedAt)],
  });
  return type ? rows.filter((r) => r.mediaItem.type === type) : rows;
}

export async function getLibraryEntry(userId: string, mediaItemId: string) {
  return db.query.libraryEntries.findFirst({
    where: and(eq(libraryEntries.userId, userId), eq(libraryEntries.mediaItemId, mediaItemId)),
  });
}

export async function getMediaItem(id: string) {
  return db.query.mediaItems.findFirst({ where: eq(mediaItems.id, id) });
}

export async function getSessionsForItem(userId: string, mediaItemId: string) {
  return db.query.immersionSessions.findMany({
    where: and(eq(immersionSessions.userId, userId), eq(immersionSessions.mediaItemId, mediaItemId)),
    orderBy: [desc(immersionSessions.startedAt)],
  });
}

/** Active/paused entries, most recently updated first; what the timer offers as quick picks. */
export async function getActiveEntries(userId: string, limit = 12) {
  return db.query.libraryEntries.findMany({
    where: and(eq(libraryEntries.userId, userId), sql`${libraryEntries.status} in ('active', 'paused', 'planning')`),
    with: { mediaItem: true },
    orderBy: [desc(libraryEntries.updatedAt)],
    limit,
  });
}

// --- Goals ---

export type GoalWithProgress = Awaited<ReturnType<typeof getGoalsWithProgress>>[number];

export async function getGoalsWithProgress(userId: string, tz: string) {
  const rows = await db.query.goals.findMany({
    where: eq(goals.userId, userId),
    orderBy: [desc(goals.createdAt)],
  });

  return Promise.all(
    rows.map(async (g) => {
      const from = dayStart(g.startDate, tz);
      const to = dayEnd(g.endDate, tz);
      const typeFilter = g.mediaType ? eq(immersionSessions.mediaType, g.mediaType) : undefined;
      const range = and(
        eq(immersionSessions.userId, userId),
        gte(immersionSessions.startedAt, from),
        lt(immersionSessions.startedAt, to),
        typeFilter,
      );

      let current: number;
      if (g.metric === "time") {
        const [row] = await db.select({ seconds: sumSeconds }).from(immersionSessions).where(range);
        current = (row?.seconds ?? 0) / 3600;
      } else {
        const [row] = await db
          .select({ amount: sql<number>`coalesce(sum(${immersionSessions.amount}), 0)::int`.mapWith(Number) })
          .from(immersionSessions)
          .where(and(range, eq(immersionSessions.amountUnit, g.metric)));
        current = row?.amount ?? 0;
      }

      const now = new Date();
      const totalMs = to.getTime() - from.getTime();
      const elapsedMs = Math.min(Math.max(now.getTime() - from.getTime(), 0), totalMs);
      const daysTotal = Math.max(1, Math.round(totalMs / 86_400_000));
      const daysLeft = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / 86_400_000));
      const remaining = Math.max(0, g.target - current);

      return {
        ...g,
        current,
        percent: Math.min(100, (current / g.target) * 100),
        expectedPercent: (elapsedMs / totalMs) * 100,
        daysTotal,
        daysLeft,
        remaining,
        perDayNeeded: daysLeft > 0 ? remaining / daysLeft : 0,
        isActive: now >= from && now < to,
        isPast: now >= to,
      };
    }),
  );
}

/** Distinct items the user logged most recently — the dashboard's quick-log shortcuts. */
export async function getRecentItems(userId: string, limit = 6) {
  const last = sql<string>`max(${immersionSessions.startedAt})`;
  return db
    .select({
      mediaItemId: mediaItems.id,
      title: mediaItems.title,
      titleNative: mediaItems.titleNative,
      coverUrl: mediaItems.coverUrl,
      type: mediaItems.type,
      lastAt: last.mapWith((v: string | Date) => new Date(v).toISOString()),
      seconds: sumSeconds,
    })
    .from(immersionSessions)
    .innerJoin(mediaItems, eq(immersionSessions.mediaItemId, mediaItems.id))
    .where(eq(immersionSessions.userId, userId))
    .groupBy(mediaItems.id)
    .orderBy(desc(last))
    .limit(limit);
}

/** Lifetime seconds + session count per media item for a user. */
export async function getItemStats(userId: string) {
  const rows = await db
    .select({ mediaItemId: immersionSessions.mediaItemId, seconds: sumSeconds, count: countRows })
    .from(immersionSessions)
    .where(and(eq(immersionSessions.userId, userId), sql`${immersionSessions.mediaItemId} is not null`))
    .groupBy(immersionSessions.mediaItemId);
  return new Map(rows.map((r) => [r.mediaItemId as string, { seconds: r.seconds, count: r.count }]));
}

/** What the whole community logged the most time on in a range — the Discover rail. */
export async function getCommunityTopItems(from: Date, to: Date, limit = 12) {
  return db
    .select({
      mediaItemId: mediaItems.id,
      title: mediaItems.title,
      titleNative: mediaItems.titleNative,
      coverUrl: mediaItems.coverUrl,
      type: mediaItems.type,
      seconds: sumSeconds,
      learners: sql<number>`count(distinct ${immersionSessions.userId})::int`.mapWith(Number),
    })
    .from(immersionSessions)
    .innerJoin(mediaItems, eq(immersionSessions.mediaItemId, mediaItems.id))
    .where(and(gte(immersionSessions.startedAt, from), lt(immersionSessions.startedAt, to)))
    .groupBy(mediaItems.id)
    .orderBy(desc(sumSeconds))
    .limit(limit);
}
