import { NextResponse, type NextRequest } from "next/server";
import { MEDIA_TYPES, type MediaType } from "@/db/schema";
import { createRateLimiter } from "@/lib/rate-limit";
import { getSession } from "@/lib/session";
import { searchExternal } from "@/lib/sources";

// Per-user cap so one account can't burn through the shared upstream search quota
// (AniList/VNDB/TMDB/Google Books) for everyone else. The client already debounces
// keystrokes by 350ms (see discover-search.tsx), so normal typing stays well under
// this; it mainly stops a script hitting this route directly in a loop. In-memory and
// therefore per-process — see src/lib/rate-limit.ts for that caveat.
const searchRateLimit = createRateLimiter({ limit: 20, windowMs: 10_000 });

// GET /api/search?type=anime&q=frieren
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, retryAfterMs } = searchRateLimit(session.user.id);
  if (!allowed) {
    return NextResponse.json(
      { results: [], warning: "Too many searches. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } },
    );
  }

  const type = request.nextUrl.searchParams.get("type") ?? "";
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!(MEDIA_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  try {
    const data = await searchExternal(type as MediaType, q);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ results: [], warning: message }, { status: 502 });
  }
}
