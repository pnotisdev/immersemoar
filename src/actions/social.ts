"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { follows, immersionSessions, sessionKudos, user } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { requireUser } from "@/lib/session";
import { getSiteUrl } from "@/lib/site";
import { createUnsubscribeToken } from "@/lib/unsubscribe-token";
import type { ActionResult } from "./types";

/**
 * Fire-and-forget: a slow or failing email provider must never break the follow action
 * itself, so this is intentionally not awaited by its caller (matches the same pattern
 * in src/lib/sources/browse.ts's cache writes). Skips demo accounts (see
 * src/db/schema/auth.ts) — their @demo.immersemoar.app addresses aren't real inboxes.
 */
async function sendNewFollowerEmail(target: { id: string; name: string; email: string }, followerName: string) {
  const unsubscribeUrl = `${getSiteUrl()}/api/unsubscribe?token=${createUnsubscribeToken(target.id)}`;
  await sendEmail({
    to: target.email,
    subject: `${followerName} started following you on immersemoar`,
    text: [
      `Hi ${target.name.split(" ")[0]},`,
      "",
      `${followerName} just started following you on immersemoar.`,
      "",
      "—",
      "Don't want these emails? Unsubscribe here (this also turns off weekly recap emails):",
      unsubscribeUrl,
    ].join("\n"),
  });
}

/** Follow a public profile. Following yourself, or a private profile, is a no-op error. */
export async function followUser(targetId: string): Promise<ActionResult<{ following: true }>> {
  const me = await requireUser();
  if (targetId === me.id) return { ok: false, error: "You can't follow yourself" };

  const [target] = await db
    .select({
      id: user.id,
      username: user.username,
      publicProfile: user.publicProfile,
      name: user.name,
      email: user.email,
      emailNotifications: user.emailNotifications,
      isDemo: user.isDemo,
    })
    .from(user)
    .where(eq(user.id, targetId))
    .limit(1);
  if (!target) return { ok: false, error: "User not found" };
  if (!target.publicProfile) return { ok: false, error: "This profile is private" };

  await db.insert(follows).values({ followerId: me.id, followingId: targetId }).onConflictDoNothing();
  revalidatePath("/community");
  if (target.username) revalidatePath(`/u/${target.username}`);

  if (target.emailNotifications && !target.isDemo) {
    sendNewFollowerEmail(target, me.name).catch((err) => {
      console.error(`[social] failed to send new-follower email to ${target.id}:`, err);
    });
  }

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
