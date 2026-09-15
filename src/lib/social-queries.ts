import "server-only";
import { and, desc, eq, gt, gte, inArray, lt, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  follows,
  immersionSessions,
  libraryEntries,
  mediaItems,
  sessionKudos,
  user,
  type MediaType,
  type Unit,
} from "@/db/schema";
import { levelFromSeconds, type LevelInfo } from "./progression";

export interface FeedItem {
  sessionId: string;
  userId: string;
  name: string;
  image: string | null;
  mediaItemId: string | null;
  title: string | null;
  coverUrl: string | null;
  mediaType: MediaType;
  label: string | null;
  startedAt: Date;
  durationSeconds: number;
  amount: number | null;
  amountUnit: Unit | null;
  notes: string | null;
  kudos: number;
  kudosByViewer: boolean;
}

export interface FeedPage {
  items: FeedItem[];
  /** ISO timestamp to pass back as `before` for the next page; null when the feed is exhausted. */
  nextCursor: string | null;
}

export type FeedScope = "global" | "following";

/** The activity feed: sessions from public profiles, newest first. */
export async function getFeed(
  viewerId: string,
  {
    scope = "global",
    limit = 20,
    before,
    ofUser,
  }: { scope?: FeedScope; limit?: number; before?: string; ofUser?: string } = {},
): Promise<FeedPage> {
  let followScope: SQL | undefined;
  if (ofUser) {
    // A single member's activity, for their profile page.
    followScope = eq(immersionSessions.userId, ofUser);
  } else if (scope === "following") {
    const ids = await getFollowingIds(viewerId);
    // Your own activity belongs in your feed too, so it is never empty once you log.
    followScope = inArray(immersionSessions.userId, [...ids, viewerId]);
  }

  const rows = await db
    .select({
      sessionId: immersionSessions.id,
      userId: user.id,
      name: user.name,
      image: user.image,
      mediaItemId: immersionSessions.mediaItemId,
      title: mediaItems.title,
      coverUrl: mediaItems.coverUrl,
      mediaType: immersionSessions.mediaType,
      label: immersionSessions.label,
      startedAt: immersionSessions.startedAt,
      durationSeconds: immersionSessions.durationSeconds,
      amount: immersionSessions.amount,
      amountUnit: immersionSessions.amountUnit,
      notes: immersionSessions.notes,
    })
    .from(immersionSessions)
    .innerJoin(user, eq(immersionSessions.userId, user.id))
    .leftJoin(mediaItems, eq(immersionSessions.mediaItemId, mediaItems.id))
    .where(
      and(
        // Private profiles never appear in anyone's feed, including their followers'.
        or(eq(user.publicProfile, true), eq(user.id, viewerId)),
        followScope,
        before ? lt(immersionSessions.startedAt, new Date(before)) : undefined,
      ),
    )
    .orderBy(desc(immersionSessions.startedAt))
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const ids = page.map((r) => r.sessionId);
  const [counts, mine] = await Promise.all([kudosCounts(ids), kudosByUser(viewerId, ids)]);

  return {
    items: page.map((r) => ({
      ...r,
      kudos: counts.get(r.sessionId) ?? 0,
      kudosByViewer: mine.has(r.sessionId),
    })),
    nextCursor: rows.length > limit ? page[page.length - 1].startedAt.toISOString() : null,
  };
}

async function kudosCounts(sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ sessionId: sessionKudos.sessionId, count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(sessionKudos)
    .where(inArray(sessionKudos.sessionId, sessionIds))
    .groupBy(sessionKudos.sessionId);
  return new Map(rows.map((r) => [r.sessionId, r.count]));
}

async function kudosByUser(userId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ sessionId: sessionKudos.sessionId })
    .from(sessionKudos)
    .where(and(eq(sessionKudos.userId, userId), inArray(sessionKudos.sessionId, sessionIds)));
  return new Set(rows.map((r) => r.sessionId));
}

// --- Follows ---

export async function getFollowingIds(userId: string): Promise<string[]> {
  const rows = await db.select({ id: follows.followingId }).from(follows).where(eq(follows.followerId, userId));
  return rows.map((r) => r.id);
}

export async function getFollowCounts(userId: string) {
  const [[followers], [following]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(follows).where(eq(follows.followerId, userId)),
  ]);
  return { followers: followers?.n ?? 0, following: following?.n ?? 0 };
}

export async function isFollowing(followerId: string, followingId: string) {
  const rows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return rows.length > 0;
}

export interface MemberRow {
  userId: string;
  name: string;
  image: string | null;
  createdAt: Date;
  /** Seconds logged in the window the directory is sorted by. */
  seconds: number;
  level: LevelInfo;
  followers: number;
  followedByViewer: boolean;
}

const sumSeconds = sql<number>`coalesce(sum(${immersionSessions.durationSeconds}), 0)::int`.mapWith(Number);

/**
 * The member directory: every public profile, with the time they logged since `since`
 * and their all-time level. `sort` decides whether newcomers or heavy loggers come first.
 */
export async function listMembers(
  viewerId: string,
  { since, sort = "active", limit = 60, q }: { since: Date; sort?: "active" | "new"; limit?: number; q?: string },
): Promise<MemberRow[]> {
  const windowed = db
    .select({
      userId: immersionSessions.userId,
      seconds: sumSeconds.as("window_seconds"),
    })
    .from(immersionSessions)
    .where(gte(immersionSessions.startedAt, since))
    .groupBy(immersionSessions.userId)
    .as("windowed");

  const lifetime = db
    .select({ userId: immersionSessions.userId, seconds: sumSeconds.as("lifetime_seconds") })
    .from(immersionSessions)
    .groupBy(immersionSessions.userId)
    .as("lifetime");

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      seconds: sql<number>`coalesce(${windowed.seconds}, 0)::int`.mapWith(Number),
      lifetimeSeconds: sql<number>`coalesce(${lifetime.seconds}, 0)::int`.mapWith(Number),
    })
    .from(user)
    .leftJoin(windowed, eq(windowed.userId, user.id))
    .leftJoin(lifetime, eq(lifetime.userId, user.id))
    .where(and(eq(user.publicProfile, true), q ? sql`${user.name} ilike ${"%" + q + "%"}` : undefined))
    // Raw ordering: leftJoin leaves the totals null, and DESC would sort those NULLs first.
    .orderBy(
      sort === "new"
        ? desc(user.createdAt)
        : sql`coalesce("windowed"."window_seconds", 0) desc, coalesce("lifetime"."lifetime_seconds", 0) desc`,
    )
    .limit(limit);

  const ids = rows.map((r) => r.userId);
  const [followerCounts, followedByViewer] = await Promise.all([countFollowers(ids), followingSubset(viewerId, ids)]);

  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    createdAt: r.createdAt,
    seconds: r.seconds,
    level: levelFromSeconds(r.lifetimeSeconds),
    followers: followerCounts.get(r.userId) ?? 0,
    followedByViewer: followedByViewer.has(r.userId),
  }));
}

async function countFollowers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ userId: follows.followingId, count: sql<number>`count(*)::int`.mapWith(Number) })
    .from(follows)
    .where(inArray(follows.followingId, userIds))
    .groupBy(follows.followingId);
  return new Map(rows.map((r) => [r.userId, r.count]));
}

async function followingSubset(viewerId: string, userIds: string[]) {
  if (userIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, userIds)));
  return new Set(rows.map((r) => r.id));
}

/** A handful of active public users the viewer doesn't follow yet. */
export async function getSuggestedMembers(viewerId: string, since: Date, limit = 5): Promise<MemberRow[]> {
  const followingIds = await getFollowingIds(viewerId);
  const exclude = [...followingIds, viewerId];

  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      seconds: sumSeconds,
    })
    .from(user)
    .innerJoin(immersionSessions, eq(immersionSessions.userId, user.id))
    .where(and(eq(user.publicProfile, true), gte(immersionSessions.startedAt, since), notIn(exclude)))
    .groupBy(user.id)
    .having(gt(sumSeconds, 0))
    .orderBy(desc(sumSeconds))
    .limit(limit);

  const lifetimes = await lifetimeSeconds(rows.map((r) => r.userId));
  const followerCounts = await countFollowers(rows.map((r) => r.userId));
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    image: r.image,
    createdAt: r.createdAt,
    seconds: r.seconds,
    level: levelFromSeconds(lifetimes.get(r.userId) ?? 0),
    followers: followerCounts.get(r.userId) ?? 0,
    followedByViewer: false,
  }));
}

function notIn(ids: string[]) {
  return ids.length === 0 ? undefined : notInArray(user.id, ids);
}

async function lifetimeSeconds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({ userId: immersionSessions.userId, seconds: sumSeconds })
    .from(immersionSessions)
    .where(inArray(immersionSessions.userId, userIds))
    .groupBy(immersionSessions.userId);
  return new Map(rows.map((r) => [r.userId, r.seconds]));
}

/** People following `userId` / people they follow, for the profile page lists. */
export async function listFollowConnections(userId: string, kind: "followers" | "following", limit = 24) {
  const [joinCol, selectCol] =
    kind === "followers" ? [follows.followerId, follows.followingId] : [follows.followingId, follows.followerId];
  return db
    .select({ userId: user.id, name: user.name, image: user.image })
    .from(follows)
    .innerJoin(user, eq(user.id, joinCol))
    .where(and(eq(selectCol, userId), eq(user.publicProfile, true)))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
}

/** Total public members and how many logged time since `since` — the community header numbers. */
export async function getCommunityPulse(since: Date) {
  const [[members], [active], [sessions]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int`.mapWith(Number) }).from(user).where(eq(user.publicProfile, true)),
    db
      .select({ n: sql<number>`count(distinct ${immersionSessions.userId})::int`.mapWith(Number) })
      .from(immersionSessions)
      .where(gte(immersionSessions.startedAt, since)),
    db
      .select({ n: sql<number>`count(*)::int`.mapWith(Number), seconds: sumSeconds })
      .from(immersionSessions)
      .where(gte(immersionSessions.startedAt, since)),
  ]);
  return {
    members: members?.n ?? 0,
    activeThisWeek: active?.n ?? 0,
    sessionsThisWeek: sessions?.n ?? 0,
    secondsThisWeek: sessions?.seconds ?? 0,
  };
}

export interface MediaCommunity {
  learners: number;
  inLibrary: number;
  seconds: number;
  avgRating: number | null;
  /** A few public members who logged time on it, most recent first. */
  recent: { userId: string; name: string; image: string | null }[];
}

/** Social proof for a media page: who else is on this title. */
export async function getMediaCommunity(mediaItemId: string): Promise<MediaCommunity> {
  const [[totals], [shelves], recent] = await Promise.all([
    db
      .select({
        learners: sql<number>`count(distinct ${immersionSessions.userId})::int`.mapWith(Number),
        seconds: sumSeconds,
      })
      .from(immersionSessions)
      .where(eq(immersionSessions.mediaItemId, mediaItemId)),
    db
      .select({
        inLibrary: sql<number>`count(*)::int`.mapWith(Number),
        avgRating: sql<number | null>`avg(${libraryEntries.rating})`.mapWith((v) => (v == null ? null : Number(v))),
      })
      .from(libraryEntries)
      .where(eq(libraryEntries.mediaItemId, mediaItemId)),
    db
      .select({ userId: user.id, name: user.name, image: user.image })
      .from(immersionSessions)
      .innerJoin(user, eq(immersionSessions.userId, user.id))
      .where(and(eq(immersionSessions.mediaItemId, mediaItemId), eq(user.publicProfile, true)))
      .groupBy(user.id)
      .orderBy(desc(sql`max(${immersionSessions.startedAt})`))
      .limit(8),
  ]);

  return {
    learners: totals?.learners ?? 0,
    seconds: totals?.seconds ?? 0,
    inLibrary: shelves?.inLibrary ?? 0,
    avgRating: shelves?.avgRating ?? null,
    recent,
  };
}
