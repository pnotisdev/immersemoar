import "server-only";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/db";
import { immersionSessions, type MediaType } from "@/db/schema";
import { dayKey, presetRange } from "./dates";
import { MEDIA_TYPE_META, type MediaGroup } from "./media";
import { levelFromSeconds, longestStreak, type LevelInfo } from "./progression";
import { computeStreak, getDailyTotals, getTypeBreakdown } from "./queries";

export interface GroupTotals {
  reading: number;
  listening: number;
  other: number;
  total: number;
}

/** Seconds per reading/listening group within [from, to). */
export async function getGroupTotals(userId: string, from: Date, to: Date): Promise<GroupTotals> {
  const rows = await getTypeBreakdown(userId, from, to);
  const out: GroupTotals = { reading: 0, listening: 0, other: 0, total: 0 };
  for (const r of rows) {
    out[MEDIA_TYPE_META[r.mediaType].group] += r.seconds;
    out.total += r.seconds;
  }
  return out;
}

export interface ReadingMetrics {
  characters: number;
  pages: number;
  /** Characters per hour, across sessions that logged characters. null if none. */
  charsPerHour: number | null;
  /** Seconds spent in sessions that logged characters. */
  charSeconds: number;
}

export async function getReadingMetrics(userId: string, from: Date, to: Date): Promise<ReadingMetrics> {
  const [row] = await db
    .select({
      characters: sql<number>`coalesce(sum(case when ${immersionSessions.amountUnit} = 'characters' then ${immersionSessions.amount} end), 0)::int`.mapWith(Number),
      pages: sql<number>`coalesce(sum(case when ${immersionSessions.amountUnit} = 'pages' then ${immersionSessions.amount} end), 0)::int`.mapWith(Number),
      charSeconds: sql<number>`coalesce(sum(case when ${immersionSessions.amountUnit} = 'characters' and ${immersionSessions.amount} > 0 then ${immersionSessions.durationSeconds} end), 0)::int`.mapWith(Number),
    })
    .from(immersionSessions)
    .where(and(eq(immersionSessions.userId, userId), gte(immersionSessions.startedAt, from), lt(immersionSessions.startedAt, to)));
  const characters = row?.characters ?? 0;
  const charSeconds = row?.charSeconds ?? 0;
  return {
    characters,
    pages: row?.pages ?? 0,
    charSeconds,
    charsPerHour: charSeconds > 0 ? Math.round(characters / (charSeconds / 3600)) : null,
  };
}

export interface Progression {
  overall: LevelInfo;
  reading: LevelInfo;
  listening: LevelInfo;
  totals: GroupTotals;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  /** Average seconds per calendar day since the first session. */
  dailyAverage: number;
  firstDay: string | null;
}

/** Everything the profile/dashboard hero needs, from all-time data. */
export async function getProgression(userId: string, tz: string, now = new Date()): Promise<Progression> {
  const allTime = presetRange("all", tz, now);
  const [totals, daily] = await Promise.all([
    getGroupTotals(userId, allTime.from, allTime.to),
    getDailyTotals(userId, allTime.from, allTime.to, tz),
  ]);
  const active = [...daily.entries()].filter(([, v]) => v.seconds > 0).map(([k]) => k);
  const todayKey = dayKey(now, tz);
  const yesterdayKey = dayKey(subDays(now, 1), tz);
  const firstDay = active.length ? active.slice().sort()[0] : null;
  const daysSinceFirst = firstDay ? Math.max(1, Math.round((new Date(todayKey).getTime() - new Date(firstDay).getTime()) / 86_400_000) + 1) : 0;

  return {
    overall: levelFromSeconds(totals.total),
    reading: levelFromSeconds(totals.reading),
    listening: levelFromSeconds(totals.listening),
    totals,
    currentStreak: computeStreak(daily, todayKey, yesterdayKey),
    longestStreak: longestStreak(active),
    activeDays: active.length,
    dailyAverage: daysSinceFirst ? totals.total / daysSinceFirst : 0,
    firstDay,
  };
}

/** Sum of seconds for a set of media types (used for per-group goals/rankings). */
export async function sumDurationForTypes(userId: string, from: Date, to: Date, types: MediaType[]) {
  if (types.length === 0) return 0;
  const [row] = await db
    .select({ seconds: sql<number>`coalesce(sum(${immersionSessions.durationSeconds}), 0)::int`.mapWith(Number) })
    .from(immersionSessions)
    .where(
      and(
        eq(immersionSessions.userId, userId),
        gte(immersionSessions.startedAt, from),
        lt(immersionSessions.startedAt, to),
        inArray(immersionSessions.mediaType, types),
      ),
    );
  return row?.seconds ?? 0;
}

export type { MediaGroup };
