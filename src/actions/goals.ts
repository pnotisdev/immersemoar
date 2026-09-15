"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { GOAL_METRICS, MEDIA_TYPES, goals } from "@/db/schema";
import { requireUser } from "@/lib/session";
import type { ActionResult } from "./types";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

const goalSchema = z
  .object({
    title: z.string().trim().min(1, "Give the goal a name").max(200),
    metric: z.enum(GOAL_METRICS),
    mediaType: z.enum(MEDIA_TYPES).nullable().optional().or(z.literal("")),
    target: z.coerce.number().int().positive("Target must be positive"),
    startDate: dateStr,
    endDate: dateStr,
  })
  .refine((g) => g.endDate >= g.startDate, { message: "End date must be after start date", path: ["endDate"] });

export type GoalInput = z.infer<typeof goalSchema>;

export async function createGoal(input: GoalInput): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const g = parsed.data;

  const [row] = await db
    .insert(goals)
    .values({
      userId: user.id,
      title: g.title,
      metric: g.metric,
      mediaType: g.mediaType || null,
      target: g.target,
      startDate: g.startDate,
      endDate: g.endDate,
    })
    .returning({ id: goals.id });
  revalidatePath("/", "layout");
  return { ok: true, data: { id: row.id } };
}

export async function updateGoal(id: string, input: GoalInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = goalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const g = parsed.data;

  const res = await db
    .update(goals)
    .set({
      title: g.title,
      metric: g.metric,
      mediaType: g.mediaType || null,
      target: g.target,
      startDate: g.startDate,
      endDate: g.endDate,
    })
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
    .returning({ id: goals.id });
  if (res.length === 0) return { ok: false, error: "Goal not found" };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, user.id)));
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}
