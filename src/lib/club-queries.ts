import "server-only";
import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers, clubPickVotes, clubPicks, clubs, immersionSessions, user } from "@/db/schema";
import { levelFromSeconds } from "./progression";

const memberCount = sql<number>`(select count(*) from ${clubMembers} where ${clubMembers.clubId} = ${clubs.id})::int`.mapWith(Number);

export type ClubCard = Awaited<ReturnType<typeof listPublicClubs>>[number];

/** Discoverable clubs, optionally filtered by search text and one tag. */
export async function listPublicClubs(opts: { q?: string; tag?: string; limit?: number } = {}) {
  const q = opts.q?.trim();
  return db
    .select({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      visibility: clubs.visibility,
      tags: clubs.tags,
      coverUrl: clubs.coverUrl,
      ownerId: clubs.ownerId,
      createdAt: clubs.createdAt,
      members: memberCount,
    })
    .from(clubs)
    .where(
      and(
        eq(clubs.visibility, "public"),
        q ? or(ilike(clubs.name, `%${q}%`), ilike(clubs.description, `%${q}%`)) : undefined,
        opts.tag ? sql`${opts.tag} = any(${clubs.tags})` : undefined,
      ),
    )
    .orderBy(desc(memberCount), desc(clubs.createdAt))
    .limit(opts.limit ?? 60);
}

/** Clubs the user belongs to (public or private). */
export async function listMyClubs(userId: string) {
  return db
    .select({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      visibility: clubs.visibility,
      tags: clubs.tags,
      coverUrl: clubs.coverUrl,
      ownerId: clubs.ownerId,
      createdAt: clubs.createdAt,
      members: memberCount,
      role: clubMembers.role,
    })
    .from(clubMembers)
    .innerJoin(clubs, eq(clubMembers.clubId, clubs.id))
    .where(eq(clubMembers.userId, userId))
    .orderBy(desc(clubMembers.joinedAt));
}

export async function getClub(id: string) {
  return db.query.clubs.findFirst({
    where: eq(clubs.id, id),
    with: {
      owner: { columns: { id: true, name: true, image: true } },
      members: { with: { user: { columns: { id: true, name: true, image: true } } }, orderBy: [clubMembers.joinedAt] },
    },
  });
}

export async function getMembership(clubId: string, userId: string) {
  return db.query.clubMembers.findFirst({ where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)) });
}

export interface ClubLeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  image: string | null;
  seconds: number;
  level: ReturnType<typeof levelFromSeconds>;
}

/** Members ranked by logged time in a range. Membership implies consent, so private profiles are included here. */
export async function getClubLeaderboard(clubId: string, from: Date, to: Date): Promise<ClubLeaderboardRow[]> {
  const members = await db
    .select({ userId: clubMembers.userId, name: user.name, image: user.image })
    .from(clubMembers)
    .innerJoin(user, eq(clubMembers.userId, user.id))
    .where(eq(clubMembers.clubId, clubId));
  if (members.length === 0) return [];
  const ids = members.map((m) => m.userId);

  const sum = sql<number>`coalesce(sum(${immersionSessions.durationSeconds}), 0)::int`.mapWith(Number);
  const [inRange, allTime] = await Promise.all([
    db
      .select({ userId: immersionSessions.userId, seconds: sum })
      .from(immersionSessions)
      .where(and(inArray(immersionSessions.userId, ids), gte(immersionSessions.startedAt, from), lt(immersionSessions.startedAt, to)))
      .groupBy(immersionSessions.userId),
    db
      .select({ userId: immersionSessions.userId, seconds: sum })
      .from(immersionSessions)
      .where(inArray(immersionSessions.userId, ids))
      .groupBy(immersionSessions.userId),
  ]);
  const range = new Map(inRange.map((r) => [r.userId, r.seconds]));
  const life = new Map(allTime.map((r) => [r.userId, r.seconds]));

  return members
    .map((m) => ({ userId: m.userId, name: m.name, image: m.image, seconds: range.get(m.userId) ?? 0, level: levelFromSeconds(life.get(m.userId) ?? 0) }))
    .sort((a, b) => b.seconds - a.seconds)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export type ClubPickView = Awaited<ReturnType<typeof getClubPicks>>[number];

/** Picks with vote counts and whether the viewer voted. */
export async function getClubPicks(clubId: string, viewerId: string) {
  const rows = await db.query.clubPicks.findMany({
    where: eq(clubPicks.clubId, clubId),
    with: {
      mediaItem: true,
      proposer: { columns: { id: true, name: true } },
      votes: { columns: { userId: true } },
    },
    orderBy: [desc(clubPicks.createdAt)],
  });
  return rows
    .map((p) => ({
      id: p.id,
      status: p.status,
      createdAt: p.createdAt,
      mediaItem: p.mediaItem,
      proposer: p.proposer,
      votes: p.votes.length,
      voted: p.votes.some((v) => v.userId === viewerId),
    }))
    .sort((a, b) => b.votes - a.votes);
}

export async function getPickVoters(pickId: string) {
  return db
    .select({ userId: user.id, name: user.name })
    .from(clubPickVotes)
    .innerJoin(user, eq(clubPickVotes.userId, user.id))
    .where(eq(clubPickVotes.pickId, pickId));
}

/** Club rankings for the dashboard card: the viewer's rank in each of their clubs this period. */
export async function getMyClubStandings(userId: string, from: Date, to: Date) {
  const mine = await listMyClubs(userId);
  return Promise.all(
    mine.map(async (c) => {
      const board = await getClubLeaderboard(c.id, from, to);
      const me = board.find((r) => r.userId === userId);
      return { club: c, rank: me?.rank ?? null, total: board.length, seconds: me?.seconds ?? 0, leader: board[0] ?? null };
    }),
  );
}
