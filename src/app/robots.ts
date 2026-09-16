import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

/**
 * Every route under src/app/(app)/ requires a signed-in session (src/app/(app)/layout.tsx
 * calls requireUser(), which redirects anonymous requests to /login) — crawling any of
 * them just burns crawl budget on a redirect, so they're disallowed explicitly rather
 * than relying on that redirect alone. /forgot-password and /reset-password are
 * excluded too (meaningless without a live token; see sitemap.ts). All /api/* routes
 * are disallowed outright — data endpoints, not pages.
 *
 * Keep this list in sync with the route table `pnpm build` prints when adding a new
 * top-level page under src/app/(app)/.
 */
const DISALLOWED_APP_ROUTES = [
  "/dashboard",
  "/library",
  "/discover",
  "/community",
  "/ranking",
  "/clubs",
  "/members",
  "/log",
  "/goals",
  "/settings",
  "/stats",
  "/texthooker",
  "/media",
  "/u",
  "/admin",
];

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...DISALLOWED_APP_ROUTES, "/forgot-password", "/reset-password", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
