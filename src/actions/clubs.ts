"use server";

import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { CLUB_TAGS, CLUB_VISIBILITIES, PICK_STATUSES, clubMembers, clubPickVotes, clubPicks, clubs, mediaItems } from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./types";

const MAX_MEMBERS = 100;

function newJoinCode() {
  // 8 chars, unambiguous alphabet.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

const clubSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  visibility: z.enum(CLUB_VISIBILITIES),
  tags: z.array(z.enum(CLUB_TAGS)).max(6).default([]),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
});
export type ClubInput = z.infer<typeof clubSchema>;

export async function createClub(input: ClubInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = clubSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const [club] = await db
    .insert(clubs)
    .values({
      name: v.name,
      description: v.description || null,
      visibility: v.visibility,
      tags: v.tags,
      coverUrl: v.coverUrl || null,
      joinCode: newJoinCode(),
      ownerId: user.id,
    })
    .returning({ id: clubs.id });
  await db.insert(clubMembers).values({ clubId: club.id, userId: user.id, role: "owner" });
  revalidatePath("/clubs", "layout");
  return { ok: true, data: { id: club.id } };
}

export async function updateClub(id: string, input: ClubInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = clubSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;
  const res = await db
    .update(clubs)
    .set({ name: v.name, description: v.description || null, visibility: v.visibility, tags: v.tags, coverUrl: v.coverUrl || null })
    .where(and(eq(clubs.id, id), eq(clubs.ownerId, user.id)))
    .returning({ id: clubs.id });
  if (res.length === 0) return { ok: false, error: "Only the owner can edit this club" };
  revalidatePath("/clubs", "layout");
  return { ok: true, data: undefined };
}

export async function rotateJoinCode(id: string): Promise<ActionResult<{ joinCode: string }>> {
  const user = await requireUser();
  const code = newJoinCode();
  const res = await db.update(clubs).set({ joinCode: code }).where(and(eq(clubs.id, id), eq(clubs.ownerId, user.id))).returning({ id: clubs.id });
  if (res.length === 0) return { ok: false, error: "Only the owner can do that" };
  revalidatePath(`/clubs/${id}`);
  return { ok: true, data: { joinCode: code } };
}

export async function deleteClub(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await db.delete(clubs).where(and(eq(clubs.id, id), eq(clubs.ownerId, user.id))).returning({ id: clubs.id });
  if (res.length === 0) return { ok: false, error: "Only the owner can delete this club" };
  revalidatePath("/clubs", "layout");
  return { ok: true, data: undefined };
}

/** Join a public club directly, or a private one with its code. Codes also work as a shortcut for public clubs. */
export async function joinClub(input: { clubId?: string; joinCode?: string }): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const code = input.joinCode?.trim().toUpperCase();
  const club = code
    ? await db.query.clubs.findFirst({ where: eq(clubs.joinCode, code) })
    : input.clubId
      ? await db.query.clubs.findFirst({ where: eq(clubs.id, input.clubId) })
      : null;
  if (!club) return { ok: false, error: code ? "No club with that code" : "Club not found" };
  if (club.visibility === "private" && !code) return { ok: false, error: "This club is private; you need its join code" };

  const existing = await db.query.clubMembers.findFirst({ where: and(eq(clubMembers.clubId, club.id), eq(clubMembers.userId, user.id)) });
  if (existing) return { ok: true, data: { id: club.id } };

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int`.mapWith(Number) })
    .from(clubMembers)
    .where(eq(clubMembers.clubId, club.id));
  if (n >= MAX_MEMBERS) return { ok: false, error: `This club is full (${MAX_MEMBERS} members)` };

  await db.insert(clubMembers).values({ clubId: club.id, userId: user.id, role: "member" }).onConflictDoNothing();
  revalidatePath("/clubs", "layout");
  return { ok: true, data: { id: club.id } };
}

export async function leaveClub(clubId: string): Promise<ActionResult> {
  const user = await requireUser();
  const club = await db.query.clubs.findFirst({ where: eq(clubs.id, clubId) });
  if (!club) return { ok: false, error: "Club not found" };
  if (club.ownerId === user.id) return { ok: false, error: "Owners can't leave; delete the club or transfer it first" };
  await db.delete(clubMembers).where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, user.id)));
  revalidatePath("/clubs", "layout");
  return { ok: true, data: undefined };
}

async function requireMember(clubId: string, userId: string) {
  const m = await db.query.clubMembers.findFirst({ where: and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)) });
  return m ?? null;
}

export async function proposePick(clubId: string, mediaItemId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!(await requireMember(clubId, user.id))) return { ok: false, error: "Join the club first" };
  const item = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, mediaItemId) });
  if (!item) return { ok: false, error: "Media not found" };
  const dup = await db.query.clubPicks.findFirst({ where: and(eq(clubPicks.clubId, clubId), eq(clubPicks.mediaItemId, mediaItemId)) });
  if (dup) return { ok: false, error: "Already proposed" };

  const [pick] = await db.insert(clubPicks).values({ clubId, mediaItemId, proposedBy: user.id }).returning({ id: clubPicks.id });
  // Proposing counts as a vote.
  await db.insert(clubPickVotes).values({ pickId: pick.id, userId: user.id }).onConflictDoNothing();
  revalidatePath(`/clubs/${clubId}`);
  return { ok: true, data: { id: pick.id } };
}

export async function toggleVote(pickId: string): Promise<ActionResult<{ voted: boolean }>> {
  const user = await requireUser();
  const pick = await db.query.clubPicks.findFirst({ where: eq(clubPicks.id, pickId) });
  if (!pick) return { ok: false, error: "Pick not found" };
  if (!(await requireMember(pick.clubId, user.id))) return { ok: false, error: "Join the club first" };

  const existing = await db.query.clubPickVotes.findFirst({ where: and(eq(clubPickVotes.pickId, pickId), eq(clubPickVotes.userId, user.id)) });
  if (existing) {
    await db.delete(clubPickVotes).where(and(eq(clubPickVotes.pickId, pickId), eq(clubPickVotes.userId, user.id)));
  } else {
    await db.insert(clubPickVotes).values({ pickId, userId: user.id });
  }
  revalidatePath(`/clubs/${pick.clubId}`);
  return { ok: true, data: { voted: !existing } };
}

export async function setPickStatus(pickId: string, status: (typeof PICK_STATUSES)[number]): Promise<ActionResult> {
  const user = await requireUser();
  if (!PICK_STATUSES.includes(status)) return { ok: false, error: "Invalid status" };
  const pick = await db.query.clubPicks.findFirst({ where: eq(clubPicks.id, pickId), with: { club: true } });
  if (!pick) return { ok: false, error: "Pick not found" };
  if (pick.club.ownerId !== user.id) return { ok: false, error: "Only the owner can change pick status" };

  // Only one "current" pick at a time.
  if (status === "current") {
    await db.update(clubPicks).set({ status: "done" }).where(and(eq(clubPicks.clubId, pick.clubId), eq(clubPicks.status, "current")));
  }
  await db.update(clubPicks).set({ status }).where(eq(clubPicks.id, pickId));
  revalidatePath(`/clubs/${pick.clubId}`);
  return { ok: true, data: undefined };
}

export async function removePick(pickId: string): Promise<ActionResult> {
  const user = await requireUser();
  const pick = await db.query.clubPicks.findFirst({ where: eq(clubPicks.id, pickId), with: { club: true } });
  if (!pick) return { ok: false, error: "Pick not found" };
  if (pick.club.ownerId !== user.id && pick.proposedBy !== user.id) return { ok: false, error: "Only the proposer or owner can remove this" };
  await db.delete(clubPicks).where(eq(clubPicks.id, pickId));
  revalidatePath(`/clubs/${pick.clubId}`);
  return { ok: true, data: undefined };
}
