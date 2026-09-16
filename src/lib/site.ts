/**
 * Canonical site origin (no trailing slash), for absolute URLs in places that need one
 * regardless of the current request — sitemap.ts, robots.ts, manifest.ts, and
 * opengraph-image.tsx, none of which have access to the incoming request's Host header
 * the way a page/route handler does.
 *
 * Falls back to BETTER_AUTH_URL (already required for auth callbacks/cookies to work at
 * all, so it's always a real deployment URL) and finally to localhost for local dev
 * where neither is set.
 */
export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
