import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { userAvatars } from "@/db/schema";

/**
 * Streams an uploaded avatar's bytes. Public/unauthenticated on purpose — avatars are
 * shown wherever a user's name appears (feed, leaderboard, other people's profiles), the
 * same way an external avatar URL would have been before this existed.
 *
 * `user.image` (src/actions/account.ts) always points here with a `?v=<updatedAt-epoch>`
 * query param, so the URL itself changes whenever the image does — safe to cache the
 * *versioned* URL forever. A request without `?v` (e.g. someone hit the bare URL
 * directly) gets a short, revalidate-on-use cache instead, since that exact URL can
 * legitimately start returning different bytes after a re-upload.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/avatar/[userId]">) {
  const { userId } = await ctx.params;
  const [row] = await db.select().from(userAvatars).where(eq(userAvatars.userId, userId)).limit(1);
  if (!row) return new NextResponse(null, { status: 404 });

  const etag = `"${row.updatedAt.getTime()}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  const versioned = request.nextUrl.searchParams.has("v");
  const bytes = Buffer.from(row.data);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": row.contentType,
      "Content-Length": String(bytes.length),
      ETag: etag,
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300, must-revalidate",
    },
  });
}
