import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  clubMembers,
  clubPickVotes,
  clubPicks,
  follows,
  goals,
  immersionSessions,
  libraryEntries,
  mediaItems,
  sessionKudos,
} from "@/db/schema";
import { getSession } from "@/lib/session";

/**
 * GDPR-style data export: every row owned by the signed-in user, as one JSON file.
 * Media items are shared/global (not personal data), so only the fields needed to
 * make the export human-readable are inlined alongside each reference to one.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const [
    sessions,
    entries,
    userGoals,
    following,
    followers,
    kudosGiven,
    memberships,
    picksProposed,
    votesCast,
  ] = await Promise.all([
    db
      .select({
        id: immersionSessions.id,
        mediaItemId: immersionSessions.mediaItemId,
        mediaTitle: mediaItems.title,
        mediaType: immersionSessions.mediaType,
        label: immersionSessions.label,
        startedAt: immersionSessions.startedAt,
        durationSeconds: immersionSessions.durationSeconds,
        amount: immersionSessions.amount,
        amountUnit: immersionSessions.amountUnit,
        notes: immersionSessions.notes,
        createdAt: immersionSessions.createdAt,
        updatedAt: immersionSessions.updatedAt,
      })
      .from(immersionSessions)
      .leftJoin(mediaItems, eq(immersionSessions.mediaItemId, mediaItems.id))
      .where(eq(immersionSessions.userId, userId))
      .orderBy(desc(immersionSessions.startedAt)),

    db
      .select({
        mediaItemId: libraryEntries.mediaItemId,
        mediaTitle: mediaItems.title,
        mediaType: mediaItems.type,
        status: libraryEntries.status,
        progress: libraryEntries.progress,
        progressUnit: libraryEntries.progressUnit,
        rating: libraryEntries.rating,
        notes: libraryEntries.notes,
        startedAt: libraryEntries.startedAt,
        finishedAt: libraryEntries.finishedAt,
        createdAt: libraryEntries.createdAt,
        updatedAt: libraryEntries.updatedAt,
      })
      .from(libraryEntries)
      .innerJoin(mediaItems, eq(libraryEntries.mediaItemId, mediaItems.id))
      .where(eq(libraryEntries.userId, userId)),

    db.select().from(goals).where(eq(goals.userId, userId)),

    db.select({ userId: follows.followingId, createdAt: follows.createdAt }).from(follows).where(eq(follows.followerId, userId)),

    db.select({ userId: follows.followerId, createdAt: follows.createdAt }).from(follows).where(eq(follows.followingId, userId)),

    db.select({ sessionId: sessionKudos.sessionId, createdAt: sessionKudos.createdAt }).from(sessionKudos).where(eq(sessionKudos.userId, userId)),

    db
      .select({ clubId: clubMembers.clubId, role: clubMembers.role, joinedAt: clubMembers.joinedAt })
      .from(clubMembers)
      .where(eq(clubMembers.userId, userId)),

    db
      .select({
        id: clubPicks.id,
        clubId: clubPicks.clubId,
        mediaItemId: clubPicks.mediaItemId,
        status: clubPicks.status,
        createdAt: clubPicks.createdAt,
      })
      .from(clubPicks)
      .where(eq(clubPicks.proposedBy, userId)),

    db.select({ pickId: clubPickVotes.pickId, createdAt: clubPickVotes.createdAt }).from(clubPickVotes).where(eq(clubPickVotes.userId, userId)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      timezone: session.user.timezone,
      publicProfile: session.user.publicProfile,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    },
    immersionSessions: sessions,
    libraryEntries: entries,
    goals: userGoals,
    social: {
      following,
      followers,
      kudosGiven,
    },
    clubs: {
      memberships,
      picksProposed,
      votesCast,
    },
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="immersemoar-export-${userId}.json"`,
    },
  });
}
