"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { db } from "@/db";
import { user, userAvatars } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { AVATAR_CONTENT_TYPE, AVATAR_SIZE, avatarUrl, MAX_AVATAR_UPLOAD_BYTES } from "@/lib/avatar";
import type { ActionResult } from "./types";

function revalidateProfile(username: string | null | undefined) {
  revalidatePath("/settings");
  if (username) revalidatePath(`/u/${username}`);
}

/**
 * Stores an uploaded image as the user's avatar: capped at MAX_AVATAR_UPLOAD_BYTES
 * before any processing (so a huge file can't burn CPU on the resize step just to be
 * rejected afterward), then resized/re-encoded server-side to a small fixed-size square
 * — never trusting the client to have already done this. See src/db/schema/app.ts for
 * why the bytes live in their own table rather than on `user` itself, and
 * src/app/api/avatar/[userId]/route.ts for how they're served back out.
 */
export async function uploadAvatar(formData: FormData): Promise<ActionResult<{ image: string }>> {
  const me = await requireUser();

  const file = formData.get("avatar");
  if (!(file instanceof File)) return { ok: false, error: "No file provided" };
  if (file.size === 0) return { ok: false, error: "That file is empty" };
  if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
    return { ok: false, error: `Images must be under ${Math.round(MAX_AVATAR_UPLOAD_BYTES / (1024 * 1024))}MB` };
  }

  let resized: Buffer;
  try {
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    resized = await sharp(inputBuffer)
      .rotate() // apply EXIF orientation before the crop, or sideways photos crop wrong
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { ok: false, error: "That doesn't look like a valid image" };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(userAvatars)
      .values({ userId: me.id, data: resized, contentType: AVATAR_CONTENT_TYPE, updatedAt: now })
      .onConflictDoUpdate({
        target: userAvatars.userId,
        set: { data: resized, contentType: AVATAR_CONTENT_TYPE, updatedAt: now },
      });
    await tx.update(user).set({ image: avatarUrl(me.id, now) }).where(eq(user.id, me.id));
  });

  revalidateProfile(me.username);
  return { ok: true, data: { image: avatarUrl(me.id, now) } };
}

/** Reverts to the initials fallback (see src/components/ranking/avatar.tsx). */
export async function removeAvatar(): Promise<ActionResult<{ image: null }>> {
  const me = await requireUser();
  await db.transaction(async (tx) => {
    await tx.delete(userAvatars).where(eq(userAvatars.userId, me.id));
    await tx.update(user).set({ image: null }).where(eq(user.id, me.id));
  });
  revalidateProfile(me.username);
  return { ok: true, data: { image: null } };
}
