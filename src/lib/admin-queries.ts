import "server-only";
import { desc, eq, ilike, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { clubs, immersionSessions, user } from "@/db/schema";

/** Admin-only: every user, optionally filtered by name/email. Exposes email — never used outside /admin. */
export async function adminListUsers({ q, limit = 40 }: { q?: string; limit?: number } = {}) {
  const term = q?.trim();
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(term ? or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`)) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit);
}

/** Admin-only: most recent sessions that have a note attached, newest first, hidden or not. */
export async function adminListSessionNotes(limit = 40) {
  return db
    .select({
      id: immersionSessions.id,
      userId: immersionSessions.userId,
      userName: user.name,
      notes: immersionSessions.notes,
      hidden: immersionSessions.hidden,
      startedAt: immersionSessions.startedAt,
    })
    .from(immersionSessions)
    .innerJoin(user, eq(immersionSessions.userId, user.id))
    .where(isNotNull(immersionSessions.notes))
    .orderBy(desc(immersionSessions.startedAt))
    .limit(limit);
}

/** Admin-only: every club with its free-text fields, newest first. */
export async function adminListClubs(limit = 60) {
  return db
    .select({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      visibility: clubs.visibility,
      hidden: clubs.hidden,
      ownerId: clubs.ownerId,
      ownerName: user.name,
      createdAt: clubs.createdAt,
    })
    .from(clubs)
    .innerJoin(user, eq(clubs.ownerId, user.id))
    .orderBy(desc(clubs.createdAt))
    .limit(limit);
}

export type AdminUserRow = Awaited<ReturnType<typeof adminListUsers>>[number];
export type AdminSessionNoteRow = Awaited<ReturnType<typeof adminListSessionNotes>>[number];
export type AdminClubRow = Awaited<ReturnType<typeof adminListClubs>>[number];
