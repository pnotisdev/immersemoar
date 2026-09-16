import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

function page(body: string, status: number) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>immersemoar</title>
<style>body{font-family:system-ui,sans-serif;background:#171b26;color:#e6e9f0;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
.card{max-width:420px;text-align:center}h1{font-size:1.1rem;margin:0 0 8px}p{color:#98a2b3;line-height:1.5}a{color:#7fb1ea}</style>
</head><body><div class="card"><h1>immersemoar</h1><p>${body}</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/**
 * No-login unsubscribe link target for the new-follower email (src/actions/social.ts).
 * GET (not POST) is deliberate — this is the standard "click the link in the email"
 * unsubscribe pattern, which can't do anything but a plain navigation. The token proves
 * the click came from an email actually sent to this user; see src/lib/unsubscribe-token.ts.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const userId = token ? verifyUnsubscribeToken(token) : null;
  if (!userId) {
    return page("This unsubscribe link is invalid or has expired.", 400);
  }

  await db.update(user).set({ emailNotifications: false }).where(eq(user.id, userId));
  return page("You&rsquo;ve been unsubscribed from immersemoar emails. You can turn them back on anytime from Settings.", 200);
}
