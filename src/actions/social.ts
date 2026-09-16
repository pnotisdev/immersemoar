"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { follows, immersionSessions, sessionKudos, user } from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./types";

/** Follow a public profile. Following yourself, or a private profile, is a no-op error. */
export async function followUser(targetId: string): Promise<ActionResult<{ following: true }>> {
  const me = await requireUser();
  if (targetId === me.id) return { ok: false, error: "You can't follow yourself" };

  const [target] = await db
    .select({ id: user.id, username: user.username, publicProfile: user.publicProfile })
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);
  if (!target) return { ok: false, error: "User not found" };
  if (!target.publicProfile) return { ok: false, error: "This profile is private" };

  await db.insert(follows).values({ followerId: me.id, followingId: targetId }).onConflictDoNothing();
  revalidatePath("/community");
  if (target.username) revalidatePath(`/u/${target.username}`);
  return { ok: true, data: { following: true } };
}

export async function unfollowUser(targetId: string): Promise<ActionResult<{ following: false }>> {
  const me = await requireUser();
  const [target] = await db.select({ username: user.username }).from(user).where(eq(user.id, targetId)).limit(1);
  await db.delete(follows).where(and(eq(follows.followerId, me.id), eq(follows.followingId, targetId)));
  revalidatePath("/community");
  if (target?.username) revalidatePath(`/u/${target.username}`);
  return { ok: true, data: { following: false } };
}

/** Toggle a kudos on someone's session. Returns the new state so the button can settle optimistically. */
export async function toggleKudos(sessionId: string): Promise<ActionResult<{ given: boolean }>> {
  const me = await requireUser();
  const [session] = await db
    .select({ id: immersionSessions.id })
    .from(immersionSessions)
    .where(eq(immersionSessions.id, sessionId))
    .limit(1);
  if (!session) return { ok: false, error: "Session not found" };

  const [existing] = await db
    .select({ userId: sessionKudos.userId })
    .from(sessionKudos)
    .where(and(eq(sessionKudos.sessionId, sessionId), eq(sessionKudos.userId, me.id)))
    .limit(1);

  if (existing) {
    await db.delete(sessionKudos).where(and(eq(sessionKudos.sessionId, sessionId), eq(sessionKudos.userId, me.id)));
    return { ok: true, data: { given: false } };
  }
  await db.insert(sessionKudos).values({ sessionId, userId: me.id }).onConflictDoNothing();
  return { ok: true, data: { given: true } };
}
