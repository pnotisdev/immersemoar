/**
 * Only honor a `next`/`redirectTo` style query param when it's a same-site
 * relative path. Rejects absolute URLs (`https://evil.com`) and
 * protocol-relative URLs (`//evil.com`, which browsers resolve using the
 * current protocol) to close an open-redirect / phishing vector.
 */
export function safeRedirect(target: string | null | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith("/") || target.startsWith("//")) return fallback;
  return target;
}
