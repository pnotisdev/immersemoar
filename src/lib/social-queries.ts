import "server-only";
import { and, desc, eq, gt, gte, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
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
  /** See LeaderboardRow.username in ranking-queries.ts for why this is assumed non-null. */
  username: string;
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
      username: sql<string>`${user.username}`,
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
        // Moderator-hidden sessions never appear in anyone else's feed. The owner
        // still sees their own (ofUser / ownerId === viewerId case) so they know
        // it was hidden rather than silently vanishing.
        or(eq(immersionSessions.hidden, false), eq(user.id, viewerId)),
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
  /** See LeaderboardRow.username in ranking-queries.ts for why this is assumed non-null. */
  username: string;
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

// --- Shared short-TTL caching for the full-table aggregates below ---
//
// listMembers, getSuggestedMembers and getCommunityPulse each run GROUP BY/SUM/COUNT
// queries over the entire immersion_sessions table, on every page load (and, via
// getCommunityPulse, on every anonymous landing-page visit too). None of them need
// per-request freshness, so the shared, non-viewer-specific part of each is wrapped in
// `unstable_cache` (this Next.js version's supported primitive for caching non-fetch
// data outside of Cache Components, which this app doesn't opt into — see
// node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md).
// Viewer-specific parts (e.g. followedByViewer) are computed after the cached call so
// they're never baked into a cache entry shared across users.
//
// unstable_cache serializes results with JSON.stringify/parse, which turns `Date`
// fields into strings on a cache hit. The cached inner functions below return
// `createdAt` as epoch milliseconds and the public wrappers convert it back to `Date`,
// so callers always see a real Date regardless of cache hit/miss.
type MemberBaseRow = Omit<MemberRow, "followedByViewer" | "createdAt"> & { createdAt: number };

const MEMBERS_TTL_SECONDS = 60;
const SUGGESTIONS_TTL_SECONDS = 60;
const SUGGESTIONS_POOL_SIZE = 50;
const PULSE_TTL_SECONDS = 60;

/**
 * Rounds a moment down to the start of its TTL bucket. Callers like `listMembers(user,
 * { since: subDays(new Date(), 7) })` construct a fresh `Date` on every call, so caching
 * keyed on the raw value would miss every time from millisecond jitter alone. Rounding
 * down first means every call within the same TTL window shares one cache key.
 */
function bucketStart(date: Date, ttlSeconds: number): number {
  const bucketMs = ttlSeconds * 1000;
  return Math.floor(date.getTime() / bucketMs) * bucketMs;
}

async function listMembersBase(
  sinceMs: number,
  sort: "active" | "new",
  limit: number,
  q: string,
): Promise<MemberBaseRow[]> {
  const since = new Date(sinceMs);
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
      username: sql<string>`${user.username}`,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      seconds: sql<number>`coalesce(${windowed.seconds}, 0)::int`.mapWith(Number),
      lifetimeSeconds: sql<number>`coalesce(${lifetime.seconds}, 0)::int`.mapWith(Number),
    })
    .from(user)
    .leftJoin(windowed, eq(windowed.userId, user.id))
    .leftJoin(lifetime, eq(lifetime.userId, user.id))
    .where(
      and(
        eq(user.publicProfile, true),
        q ? sql`${user.name} ilike ${"%" + q + "%"}` : undefined,
        // Demo accounts (seed-demo.ts) would otherwise sit at the top of "most active"
        // forever (Mika's 908h) and misrepresent themselves as real top users. Left in
        // for "newest" — it's not a competitive signal, and their backdated createdAt
        // already keeps them off the front page there anyway.
        sort === "active" ? eq(user.isDemo, false) : undefined,
      ),
    )
    // Raw ordering: leftJoin leaves the totals null, and DESC would sort those NULLs first.
    .orderBy(
      sort === "new"
        ? desc(user.createdAt)
        : sql`coalesce("windowed"."window_seconds", 0) desc, coalesce("lifetime"."lifetime_seconds", 0) desc`,
    )
    .limit(limit);

  const ids = rows.map((r) => r.userId);
  const followerCounts = await countFollowers(ids);

  return rows.map((r) => ({
    userId: r.userId,
    username: r.username,
    name: r.name,
    image: r.image,
    createdAt: r.createdAt.getTime(),
    seconds: r.seconds,
    level: levelFromSeconds(r.lifetimeSeconds),
    followers: followerCounts.get(r.userId) ?? 0,
  }));
}

const cachedListMembersBase = unstable_cache(listMembersBase, ["social", "members-base"], {
  revalidate: MEMBERS_TTL_SECONDS,
});

/**
 * The member directory: every public profile, with the time they logged since `since`
 * and their all-time level. `sort` decides whether newcomers or heavy loggers come first.
 */
export async function listMembers(
  viewerId: string,
  { since, sort = "active", limit = 60, q }: { since: Date; sort?: "active" | "new"; limit?: number; q?: string },
): Promise<MemberRow[]> {
  const base = await cachedListMembersBase(bucketStart(since, MEMBERS_TTL_SECONDS), sort, limit, q ?? "");
  const followedByViewer = await followingSubset(
    viewerId,
    base.map((r) => r.userId),
  );

  return base.map((r) => ({
    ...r,
    createdAt: new Date(r.createdAt),
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

type ActivePoolRow = { userId: string; username: string; name: string; image: string | null; createdAt: number; seconds: number };

/**
 * The shared, non-personalized candidate pool behind getSuggestedMembers: the most
 * active public members in the window, full stop. Deliberately does NOT exclude the
 * viewer's follows here — doing that in SQL would make the query (and its cache entry)
 * viewer-specific, defeating the point of caching it. Exclusion happens in memory in
 * getSuggestedMembers instead, against this one shared pool.
 */
async function activeMembersPool(sinceMs: number, poolSize: number): Promise<ActivePoolRow[]> {
  const since = new Date(sinceMs);
  const rows = await db
    .select({
      userId: user.id,
      username: sql<string>`${user.username}`,
      name: user.name,
      image: user.image,
      createdAt: user.createdAt,
      seconds: sumSeconds,
    })
    .from(user)
    .innerJoin(immersionSessions, eq(immersionSessions.userId, user.id))
    // isDemo: see the "most active" comment in listMembersBase above — this pool is
    // exactly the kind of "who's a top user" surface that shouldn't include them.
    .where(and(eq(user.publicProfile, true), eq(user.isDemo, false), gte(immersionSessions.startedAt, since)))
    .groupBy(user.id)
    .having(gt(sumSeconds, 0))
    .orderBy(desc(sumSeconds))
    .limit(poolSize);

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.getTime() }));
}

const cachedActiveMembersPool = unstable_cache(activeMembersPool, ["social", "suggested-pool"], {
  revalidate: SUGGESTIONS_TTL_SECONDS,
});

/**
 * A handful of active public users the viewer doesn't follow yet.
 *
 * Ranked from a shared, cached pool of the top `SUGGESTIONS_POOL_SIZE` active members
 * (see activeMembersPool), then filtered down to this viewer's exclusions in memory.
 * If a viewer already follows most of the pool, they may see fewer than `limit`
 * suggestions rather than the pool being widened just for them — a deliberate trade for
 * not running a per-viewer full-table aggregate on every request.
 */
export async function getSuggestedMembers(viewerId: string, since: Date, limit = 5): Promise<MemberRow[]> {
  const [followingIds, pool] = await Promise.all([
    getFollowingIds(viewerId),
    cachedActiveMembersPool(bucketStart(since, SUGGESTIONS_TTL_SECONDS), SUGGESTIONS_POOL_SIZE),
  ]);
  const exclude = new Set([...followingIds, viewerId]);
  const candidates = pool.filter((r) => !exclude.has(r.userId)).slice(0, limit);
  const ids = candidates.map((r) => r.userId);

  const [lifetimes, followerCounts] = await Promise.all([lifetimeSeconds(ids), countFollowers(ids)]);
  return candidates.map((r) => ({
    userId: r.userId,
    username: r.username,
    name: r.name,
    image: r.image,
    createdAt: new Date(r.createdAt),
    seconds: r.seconds,
    level: levelFromSeconds(lifetimes.get(r.userId) ?? 0),
    followers: followerCounts.get(r.userId) ?? 0,
    followedByViewer: false,
  }));
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
    .select({ userId: user.id, username: sql<string>`${user.username}`, name: user.name, image: user.image })
    .from(follows)
    .innerJoin(user, eq(user.id, joinCol))
    .where(and(eq(selectCol, userId), eq(user.publicProfile, true)))
    .orderBy(desc(follows.createdAt))
    .limit(limit);
}

async function communityPulseBase(sinceMs: number) {
  const since = new Date(sinceMs);
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

const cachedCommunityPulseBase = unstable_cache(communityPulseBase, ["social", "community-pulse"], {
  revalidate: PULSE_TTL_SECONDS,
});

/**
 * Total public members and how many logged time since `since` — the community header
 * numbers. Shown to every viewer (including anonymous landing-page visitors) with no
 * personalization at all, so the whole result is cached wholesale.
 */
export async function getCommunityPulse(since: Date) {
  return cachedCommunityPulseBase(bucketStart(since, PULSE_TTL_SECONDS));
}

export interface MediaCommunity {
  learners: number;
  inLibrary: number;
  seconds: number;
  avgRating: number | null;
  /** A few public members who logged time on it, most recent first. */
  recent: { userId: string; username: string; name: string; image: string | null }[];
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
      .select({ userId: user.id, username: sql<string>`${user.username}`, name: user.name, image: user.image })
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
