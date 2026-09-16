/**
 * Shared rules for the `user.username` column (src/db/schema/auth.ts), enforced both by
 * the better-auth `username` plugin (src/lib/auth.ts, for user-supplied values via
 * settings) and by the scripts that assign one automatically (the signup
 * databaseHooks.user.create.before hook in src/lib/auth.ts, and
 * scripts/backfill-usernames.ts for pre-existing rows).
 */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
/** Lowercase alphanumeric + underscore, matching the normalized (post-lowercasing) form. */
export const USERNAME_RE = /^[a-z0-9_]+$/;

export function isValidUsername(value: string): boolean {
  return value.length >= USERNAME_MIN && value.length <= USERNAME_MAX && USERNAME_RE.test(value);
}

/**
 * Turns a display name or email local-part into a candidate username: lowercase,
 * diacritics stripped, anything outside [a-z0-9_] dropped, clamped to USERNAME_MAX.
 * Non-Latin names (e.g. purely Japanese) can collapse to "" — callers should fall back
 * to another source (email local-part) or a generic base like "user" in that case.
 */
export function slugifyUsername(input: string): string {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics after NFKD decomposition
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "");
  return cleaned.slice(0, USERNAME_MAX);
}

/**
 * Appends a numeric suffix until `base` (or `base` + suffix) isn't in `taken`, trimming
 * the base so the result never exceeds USERNAME_MAX. Pads short/empty bases up to
 * USERNAME_MIN first (a bare numeric suffix like "2" would otherwise be too short, and
 * an empty base would produce a lone number). Callers own `taken`: add the result to it
 * once persisted so a batch of calls never hands out the same value twice.
 */
export function dedupeUsername(base: string, taken: Set<string>): string {
  const padded = base.length >= USERNAME_MIN ? base : (base + "user").slice(0, USERNAME_MAX).padEnd(USERNAME_MIN, "0");
  if (!taken.has(padded)) return padded;
  for (let n = 2; n < 1_000_000; n++) {
    const suffix = String(n);
    const trimmedBase = padded.slice(0, Math.max(USERNAME_MIN - suffix.length, USERNAME_MAX - suffix.length));
    const candidate = `${trimmedBase}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Astronomically unlikely (a million collisions on one base) — fall back to something
  // unique-ish rather than looping forever.
  return `${padded.slice(0, USERNAME_MAX - 6)}${Date.now().toString(36).slice(-6)}`;
}
