"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { ENTRY_STATUSES, MEDIA_SOURCES, MEDIA_TYPES, UNITS, libraryEntries, mediaItems } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./types";

const searchResultSchema = z.object({
  source: z.enum(MEDIA_SOURCES.filter((s) => s !== "manual") as [string, ...string[]]),
  sourceId: z.string().min(1),
  mediaType: z.enum(MEDIA_TYPES),
  title: z.string().min(1).max(500),
  titleNative: z.string().max(500).nullable(),
  coverUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable().optional(),
  year: z.number().int().nullable(),
  description: z.string().max(2000).nullable(),
  externalUrl: z.string().url().nullable(),
  totalAmount: z.number().int().positive().nullable(),
  totalUnit: z.enum(UNITS).nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/** Insert-or-update a media item from an external search hit, and put it in the user's library. */
export async function addFromSearch(
  input: z.infer<typeof searchResultSchema>,
  status: (typeof ENTRY_STATUSES)[number] = "planning",
): Promise<ActionResult<{ mediaItemId: string }>> {
  const user = await requireUser();
  const parsed = searchResultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid search result" };
  const r = parsed.data;

  const [item] = await db
    .insert(mediaItems)
    .values({
      type: r.mediaType,
      title: r.title,
      titleNative: r.titleNative,
      coverUrl: r.coverUrl,
      bannerUrl: r.bannerUrl ?? null,
      year: r.year,
      description: r.description,
      externalUrl: r.externalUrl,
      source: r.source as (typeof MEDIA_SOURCES)[number],
      sourceId: r.sourceId,
      totalAmount: r.totalAmount,
      totalUnit: r.totalUnit,
      metadata: r.metadata,
      createdBy: user.id,
    })
    .onConflictDoUpdate({
      target: [mediaItems.source, mediaItems.sourceId],
      set: {
        title: r.title,
        titleNative: r.titleNative,
        coverUrl: r.coverUrl,
        bannerUrl: r.bannerUrl ?? null,
        year: r.year,
        description: r.description,
        externalUrl: r.externalUrl,
        totalAmount: r.totalAmount,
        totalUnit: r.totalUnit,
        metadata: r.metadata,
      },
    })
    .returning({ id: mediaItems.id });

  await ensureEntry(user.id, item.id, status, r.totalUnit ?? MEDIA_TYPE_META[r.mediaType].defaultUnit);
  revalidatePath("/", "layout");
  return { ok: true, data: { mediaItemId: item.id } };
}

const manualSchema = z.object({
  type: z.enum(MEDIA_TYPES),
  title: z.string().trim().min(1).max(500),
  titleNative: z.string().trim().max(500).optional().or(z.literal("")),
  coverUrl: z.string().trim().url().optional().or(z.literal("")),
  year: z.coerce.number().int().min(1800).max(2200).optional().or(z.literal("")),
  totalAmount: z.coerce.number().int().positive().optional().or(z.literal("")),
  totalUnit: z.enum(UNITS).optional().or(z.literal("")),
  status: z.enum(ENTRY_STATUSES).default("planning"),
});

export async function addManual(input: z.infer<typeof manualSchema>): Promise<ActionResult<{ mediaItemId: string }>> {
  const user = await requireUser();
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const [item] = await db
    .insert(mediaItems)
    .values({
      type: v.type,
      title: v.title,
      titleNative: v.titleNative || null,
      coverUrl: v.coverUrl || null,
      year: v.year === "" || v.year === undefined ? null : v.year,
      totalAmount: v.totalAmount === "" || v.totalAmount === undefined ? null : v.totalAmount,
      totalUnit: v.totalUnit || null,
      source: "manual",
      createdBy: user.id,
    })
    .returning({ id: mediaItems.id });

  await ensureEntry(user.id, item.id, v.status, v.totalUnit || MEDIA_TYPE_META[v.type].defaultUnit);
  revalidatePath("/", "layout");
  return { ok: true, data: { mediaItemId: item.id } };
}

/** Create the library entry if the user doesn't have one yet. */
async function ensureEntry(
  userId: string,
  mediaItemId: string,
  status: (typeof ENTRY_STATUSES)[number],
  progressUnit: (typeof UNITS)[number] | null,
) {
  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(libraryEntries)
    .values({
      userId,
      mediaItemId,
      status,
      progressUnit,
      startedAt: status === "active" ? today : null,
      finishedAt: status === "finished" ? today : null,
    })
    .onConflictDoNothing({ target: [libraryEntries.userId, libraryEntries.mediaItemId] });
}

const entryPatchSchema = z.object({
  status: z.enum(ENTRY_STATUSES).optional(),
  progress: z.coerce.number().int().min(0).optional(),
  progressUnit: z.enum(UNITS).nullable().optional(),
  rating: z.coerce.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  finishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function updateEntry(mediaItemId: string, patch: z.infer<typeof entryPatchSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = entryPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;

  const existing = await db.query.libraryEntries.findFirst({
    where: and(eq(libraryEntries.userId, user.id), eq(libraryEntries.mediaItemId, mediaItemId)),
  });
  if (!existing) return { ok: false, error: "Not in your library" };

  const today = new Date().toISOString().slice(0, 10);
  const set: Partial<typeof libraryEntries.$inferInsert> = { ...p, updatedAt: new Date() };
  // Never let progress exceed a known total in the same unit.
  const item = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, mediaItemId) });
  const unit = p.progressUnit === undefined ? existing.progressUnit : p.progressUnit;
  if (set.progress !== undefined && item?.totalAmount && item.totalUnit === unit) {
    set.progress = Math.min(set.progress, item.totalAmount);
  }
  // Auto-stamp start/finish dates on status transitions unless explicitly provided.
  if (p.status === "active" && !existing.startedAt && p.startedAt === undefined) set.startedAt = today;
  if (p.status === "finished" && !existing.finishedAt && p.finishedAt === undefined) set.finishedAt = today;

  await db.update(libraryEntries).set(set).where(eq(libraryEntries.id, existing.id));
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function removeEntry(mediaItemId: string): Promise<ActionResult> {
  const user = await requireUser();
  await db
    .delete(libraryEntries)
    .where(and(eq(libraryEntries.userId, user.id), eq(libraryEntries.mediaItemId, mediaItemId)));
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

const itemPatchSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  titleNative: z.string().trim().max(500).nullable().optional(),
  coverUrl: z.string().trim().url().nullable().optional().or(z.literal("")),
  totalAmount: z.coerce.number().int().positive().nullable().optional(),
  totalUnit: z.enum(UNITS).nullable().optional(),
});

/** Edit fields on a media item. Manual items: only by their creator. External items: only the total length (metadata is often missing). */
export async function updateMediaItem(id: string, patch: z.infer<typeof itemPatchSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = itemPatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const item = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, id) });
  if (!item) return { ok: false, error: "Not found" };

  const p = parsed.data;
  const isOwnerOfManual = item.source === "manual" && item.createdBy === user.id;
  const set: Partial<typeof mediaItems.$inferInsert> = {};
  if (p.totalAmount !== undefined) set.totalAmount = p.totalAmount;
  if (p.totalUnit !== undefined) set.totalUnit = p.totalUnit;
  if (isOwnerOfManual) {
    if (p.title !== undefined) set.title = p.title;
    if (p.titleNative !== undefined) set.titleNative = p.titleNative;
    if (p.coverUrl !== undefined) set.coverUrl = p.coverUrl || null;
  }
  if (Object.keys(set).length === 0) return { ok: true, data: undefined };

  await db.update(mediaItems).set(set).where(eq(mediaItems.id, id));
  // Keep entries' progress unit in sync when the total unit is first set.
  if (set.totalUnit) {
    await db
      .update(libraryEntries)
      .set({ progressUnit: set.totalUnit })
      .where(and(eq(libraryEntries.mediaItemId, id), eq(libraryEntries.userId, user.id), sql`${libraryEntries.progressUnit} is null`));
  }
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

/** Add an already-existing media item (e.g. one another user added) to this user's library. */
export async function addExistingToLibrary(mediaItemId: string): Promise<ActionResult> {
  const user = await requireUser();
  const item = await db.query.mediaItems.findFirst({ where: eq(mediaItems.id, mediaItemId) });
  if (!item) return { ok: false, error: "Not found" };
  await ensureEntry(user.id, item.id, "planning", item.totalUnit ?? MEDIA_TYPE_META[item.type].defaultUnit);
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
