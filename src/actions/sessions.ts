"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { MEDIA_TYPES, UNITS, activeTimers, immersionSessions, libraryEntries, mediaItems } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./types";

const optionalInt = z.coerce.number().int().min(0).nullable().optional().or(z.literal(""));
const optionalUnit = z.enum(UNITS).nullable().optional().or(z.literal(""));

const sessionInputSchema = z.object({
  mediaItemId: z.string().uuid().nullable().optional().or(z.literal("")),
  mediaType: z.enum(MEDIA_TYPES),
  label: z.string().trim().max(200).nullable().optional().or(z.literal("")),
  /** ISO timestamp (UTC instant). */
  startedAt: z.string().datetime({ offset: true }),
  durationSeconds: z.coerce.number().int().min(1).max(24 * 3600),
  amount: optionalInt,
  amountUnit: optionalUnit,
  notes: z.string().trim().max(5000).nullable().optional().or(z.literal("")),
});
export type SessionInput = z.infer<typeof sessionInputSchema>;

function normalize(v: SessionInput) {
  return {
    mediaItemId: v.mediaItemId || null,
    mediaType: v.mediaType,
    label: v.label || null,
    startedAt: new Date(v.startedAt),
    durationSeconds: v.durationSeconds,
    amount: v.amount === "" || v.amount == null ? null : v.amount,
    amountUnit: v.amountUnit || null,
    notes: v.notes || null,
  };
}

/** If the session references an item the user owns, make sure there's a library entry and bump its progress. */
async function applyProgress(userId: string, mediaItemId: string | null, amountDelta: number, unit: string | null) {
  if (!mediaItemId) return;
  const item = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, mediaItemId) });
  if (!item) return;

  const today = new Date().toISOString().slice(0, 10);
  // Logging time against something implies you're actively consuming it.
  await db
    .insert(libraryEntries)
    .values({
      userId,
      mediaItemId,
      status: "active",
      progressUnit: item.totalUnit ?? MEDIA_TYPE_META[item.type].defaultUnit,
      startedAt: today,
    })
    .onConflictDoNothing({ target: [libraryEntries.userId, libraryEntries.mediaItemId] });

  const entry = await db.query.libraryEntries.findFirst({
    where: and(eq(libraryEntries.userId, userId), eq(libraryEntries.mediaItemId, mediaItemId)),
  });
  if (!entry) return;

  const set: Partial<typeof libraryEntries.$inferInsert> = { updatedAt: new Date() };
  if (entry.status === "planning") {
    set.status = "active";
    set.startedAt = entry.startedAt ?? today;
  }
  if (amountDelta !== 0 && unit && unit === entry.progressUnit) {
    set.progress = Math.max(0, entry.progress + amountDelta);
    // Reaching the known total caps progress and auto-finishes the entry.
    if (item.totalAmount && item.totalUnit === unit && set.progress >= item.totalAmount) {
      set.progress = item.totalAmount;
      if (entry.status !== "finished") {
        set.status = "finished";
        set.finishedAt = entry.finishedAt ?? today;
      }
    }
  }
  await db.update(libraryEntries).set(set).where(eq(libraryEntries.id, entry.id));
}

export async function createSession(input: SessionInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = normalize(parsed.data);

  const [row] = await db
    .insert(immersionSessions)
    .values({ userId: user.id, ...v })
    .returning({ id: immersionSessions.id });

  await applyProgress(user.id, v.mediaItemId, v.amount ?? 0, v.amountUnit);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: row.id } };
}

export async function updateSession(id: string, input: SessionInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = sessionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = normalize(parsed.data);

  const existing = await db.query.immersionSessions.findFirst({
    where: and(eq(immersionSessions.id, id), eq(immersionSessions.userId, user.id)),
  });
  if (!existing) return { ok: false, error: "Session not found" };

  await db
    .update(immersionSessions)
    .set({ ...v, updatedAt: new Date() })
    .where(eq(immersionSessions.id, id));

  // Reconcile progress: undo the old contribution, apply the new one.
  if (existing.mediaItemId === v.mediaItemId) {
    const oldAmt = existing.amountUnit === v.amountUnit ? (existing.amount ?? 0) : 0;
    await applyProgress(user.id, v.mediaItemId, (v.amount ?? 0) - oldAmt, v.amountUnit);
  } else {
    await applyProgress(user.id, existing.mediaItemId, -(existing.amount ?? 0), existing.amountUnit);
    await applyProgress(user.id, v.mediaItemId, v.amount ?? 0, v.amountUnit);
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteSession(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const existing = await db.query.immersionSessions.findFirst({
    where: and(eq(immersionSessions.id, id), eq(immersionSessions.userId, user.id)),
  });
  if (!existing) return { ok: false, error: "Session not found" };

  await db.delete(immersionSessions).where(eq(immersionSessions.id, id));
  if (existing.mediaItemId && existing.amount) {
    // Only roll back progress; don't touch status.
    await db
      .update(libraryEntries)
      .set({ progress: sql`greatest(0, ${libraryEntries.progress} - ${existing.amount})` })
      .where(
        and(
          eq(libraryEntries.userId, user.id),
          eq(libraryEntries.mediaItemId, existing.mediaItemId),
          existing.amountUnit ? eq(libraryEntries.progressUnit, existing.amountUnit) : sql`false`,
        ),
      );
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// --- Timer ---

const startTimerSchema = z.object({
  mediaItemId: z.string().uuid().nullable().optional().or(z.literal("")),
  mediaType: z.enum(MEDIA_TYPES),
  label: z.string().trim().max(200).nullable().optional().or(z.literal("")),
});

export async function startTimer(input: z.infer<typeof startTimerSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = startTimerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const v = parsed.data;

  let mediaType = v.mediaType;
  const mediaItemId = v.mediaItemId || null;
  if (mediaItemId) {
    const item = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, mediaItemId) });
    if (!item) return { ok: false, error: "Media item not found" };
    mediaType = item.type;
  }

  await db
    .insert(activeTimers)
    .values({ userId: user.id, mediaItemId, mediaType, label: v.label || null, startedAt: new Date() })
    .onConflictDoUpdate({
      target: activeTimers.userId,
      set: { mediaItemId, mediaType, label: v.label || null, startedAt: new Date() },
    });
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

const stopTimerSchema = z.object({
  amount: optionalInt,
  amountUnit: optionalUnit,
  notes: z.string().trim().max(5000).nullable().optional().or(z.literal("")),
});

/** Stop the running timer and turn it into a session. Timers shorter than 30s are discarded. */
export async function stopTimer(input: z.infer<typeof stopTimerSchema>): Promise<ActionResult<{ id: string | null }>> {
  const user = await requireUser();
  const parsed = stopTimerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const timer = await db.query.activeTimers.findFirst({ where: eq(activeTimers.userId, user.id) });
  if (!timer) return { ok: false, error: "No running timer" };

  const durationSeconds = Math.min(24 * 3600, Math.round((Date.now() - timer.startedAt.getTime()) / 1000));
  await db.delete(activeTimers).where(eq(activeTimers.userId, user.id));

  if (durationSeconds < 30) {
    revalidatePath("/", "layout");
    return { ok: true, data: { id: null } };
  }

  const amount = parsed.data.amount === "" || parsed.data.amount == null ? null : parsed.data.amount;
  const amountUnit = parsed.data.amountUnit || null;
  const [row] = await db
    .insert(immersionSessions)
    .values({
      userId: user.id,
      mediaItemId: timer.mediaItemId,
      mediaType: timer.mediaType,
      label: timer.label,
      startedAt: timer.startedAt,
      durationSeconds,
      amount,
      amountUnit,
      notes: parsed.data.notes || null,
    })
    .returning({ id: immersionSessions.id });

  await applyProgress(user.id, timer.mediaItemId, amount ?? 0, amountUnit);
  revalidatePath("/", "layout");
  return { ok: true, data: { id: row.id } };
}

export async function discardTimer(): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(activeTimers).where(eq(activeTimers.userId, user.id));
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
