import type { MetadataRoute } from "next";
import { LAST_UPDATED as PRIVACY_UPDATED } from "@/app/(legal)/privacy/page";
import { LAST_UPDATED as TERMS_UPDATED } from "@/app/(legal)/terms/page";
import { getSiteUrl } from "@/lib/site";

/**
 * Only genuinely public, non-authenticated routes. Everything under src/app/(app)/ sits
 * behind requireUser() (see src/app/(app)/layout.tsx) and has no business in search
 * results; src/app/robots.ts disallows that whole tree for the same reason.
 * /forgot-password and /reset-password are excluded too — utility pages that are
 * meaningless without a live token, not something worth sending search traffic to.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return [
    { url: base, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/terms`, lastModified: TERMS_UPDATED, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, lastModified: PRIVACY_UPDATED, changeFrequency: "yearly", priority: 0.3 },
  ];
}
