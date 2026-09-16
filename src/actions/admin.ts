"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clubs, immersionSessions, session, user } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import type { ActionResult } from "./types";

// These actions do their own authorization (requireAdmin) and then write
// role/banned directly via Drizzle, rather than calling Better Auth's
// auth.api.banUser/setRole. Those endpoints re-check the *caller's* session
// role against the admin plugin's own permission system — which doesn't know
// about our ADMIN_EMAILS bootstrap (see src/lib/admin.ts), so a bootstrapped
// admin who isn't yet role="admin" in the database would be rejected by them.
// requireAdmin() is the single source of truth for "is this caller allowed";
// once it passes, writing the columns directly is simpler and avoids that gap.

export async function setSessionHidden(sessionId: string, hidden: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db.update(immersionSessions).set({ hidden }).where(eq(immersionSessions.id, sessionId));
  revalidatePath("/admin");
  revalidatePath("/community");
  return { ok: true, data: undefined };
}

export async function setClubHidden(clubId: string, hidden: boolean): Promise<ActionResult> {
  await requireAdmin();
  await db.update(clubs).set({ hidden }).where(eq(clubs.id, clubId));
  revalidatePath("/admin");
  revalidatePath("/clubs", "layout");
  return { ok: true, data: undefined };
}

/** Disables sign-in for a user and immediately revokes their existing sessions. */
export async function banUserAction(userId: string, reason?: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id) return { ok: false, error: "You can't ban yourself" };
  await db.update(user).set({ banned: true, banReason: reason || null, banExpires: null }).where(eq(user.id, userId));
  await db.delete(session).where(eq(session.userId, userId));
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

export async function unbanUserAction(userId: string): Promise<ActionResult> {
  await requireAdmin();
  await db.update(user).set({ banned: false, banReason: null, banExpires: null }).where(eq(user.id, userId));
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}

export async function setUserRoleAction(userId: string, role: "user" | "admin"): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (userId === admin.id && role !== "admin") return { ok: false, error: "You can't demote yourself" };
  await db.update(user).set({ role }).where(eq(user.id, userId));
  revalidatePath("/admin");
  return { ok: true, data: undefined };
}
