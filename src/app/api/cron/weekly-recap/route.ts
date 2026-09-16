import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { user } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/site";
import { formatWeeklyRecapEmail, getWeeklyRecap } from "@/lib/recap";
import { createUnsubscribeToken } from "@/lib/unsubscribe-token";

/**
 * Generates and sends every eligible user's weekly recap. Deliberately NOT wired up to
 * any scheduler (no VPS cron entry, no external scheduling service) — that's a
 * deployment-time decision left for later. This endpoint is safe to expose publicly
 * (no session/cookie needed to call it) because it requires CRON_SECRET; add that env
 * var and point whatever scheduler you end up using at:
 *
 *   GET /api/cron/weekly-recap?secret=<CRON_SECRET>
 *   (or an `Authorization: Bearer <CRON_SECRET>` header instead of the query param)
 *
 * Safe to call more than once — it doesn't track "already sent this week" state, so
 * calling it twice in the same week just re-sends the same recap. Whoever wires up
 * scheduling should call it at most once a week.
 */
export async function GET(request: NextRequest) {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  const provided = request.nextUrl.searchParams.get("secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== configured) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // isDemo excluded: seed-demo.ts accounts have no real inbox behind their
  // @demo.immersemoar.app addresses (see src/db/schema/auth.ts).
  const recipients = await db
    .select({ id: user.id, name: user.name, email: user.email, timezone: user.timezone })
    .from(user)
    .where(and(eq(user.emailNotifications, true), eq(user.isDemo, false)));

  const base = getSiteUrl();
  let sent = 0;
  let failed = 0;
  const errors: { userId: string; message: string }[] = [];

  for (const recipient of recipients) {
    try {
      const recap = await getWeeklyRecap(recipient.id, recipient.timezone ?? "UTC");
      const unsubscribeUrl = `${base}/api/unsubscribe?token=${createUnsubscribeToken(recipient.id)}`;
      const { subject, text } = formatWeeklyRecapEmail(recipient.name, recap, unsubscribeUrl);
      await sendEmail({ to: recipient.email, subject, text });
      sent++;
    } catch (err) {
      failed++;
      errors.push({ userId: recipient.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ eligible: recipients.length, sent, failed, errors: errors.slice(0, 20) });
}
