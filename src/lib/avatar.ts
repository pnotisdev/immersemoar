/**
 * Shared avatar constants/helpers — imported from both server code (src/actions/account.ts,
 * src/app/api/avatar/[userId]/route.ts) and the client-side settings form, so this file
 * itself must stay environment-agnostic (no `server-only`, no Node-only APIs).
 */

/** Rejected before any processing — see src/actions/account.ts. */
export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB
/** Stored/served dimensions — square, small enough that nobody's avatar meaningfully bloats the database. */
export const AVATAR_SIZE = 256;
export const AVATAR_CONTENT_TYPE = "image/webp";

/** The URL src/actions/account.ts points `user.image` at after a successful upload. */
export function avatarUrl(userId: string, updatedAt: Date | number): string {
  const v = typeof updatedAt === "number" ? updatedAt : updatedAt.getTime();
  return `/api/avatar/${userId}?v=${v}`;
}
