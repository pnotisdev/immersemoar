import "server-only";
import { subDays } from "date-fns";
import { presetRange } from "./dates";
import { formatDuration } from "./format";
import { getGoalsWithProgress, getTopItems, sumDuration } from "./queries";
import { getUserRank } from "./ranking-queries";

export interface WeeklyRecap {
  seconds: number;
  /** The 7 days before that, for a "vs last week" comparison. */
  previousSeconds: number;
  topItems: { title: string; seconds: number }[];
  activeGoals: { title: string; percent: number }[];
  rank: number | null;
}

/**
 * A user's last 7 days, entirely from existing query helpers (src/lib/queries.ts,
 * src/lib/ranking-queries.ts) — no new aggregation. Used by both the weekly recap email
 * (src/app/api/cron/weekly-recap/route.ts) and, if useful later, an in-app equivalent.
 */
export async function getWeeklyRecap(userId: string, tz: string, now = new Date()): Promise<WeeklyRecap> {
  const range = presetRange("7d", tz, now);
  const previousRange = { from: subDays(range.from, 7), to: range.from };

  const [seconds, previousSeconds, topItems, goals, rank] = await Promise.all([
    sumDuration(userId, range.from, range.to),
    sumDuration(userId, previousRange.from, previousRange.to),
    getTopItems(userId, range.from, range.to, 3),
    getGoalsWithProgress(userId, tz),
    getUserRank(userId, { from: range.from, to: range.to }),
  ]);

  return {
    seconds,
    previousSeconds,
    topItems: topItems.map((t) => ({ title: t.title, seconds: t.seconds })),
    activeGoals: goals.filter((g) => g.isActive).map((g) => ({ title: g.title, percent: Math.round(g.percent) })),
    rank: rank.rank,
  };
}

/** Plain-text email body (see src/lib/email.ts — text is also lightly auto-converted to HTML). */
export function formatWeeklyRecapEmail(name: string, recap: WeeklyRecap, unsubscribeUrl: string): { subject: string; text: string } {
  const firstName = name.split(" ")[0];
  const lines: string[] = [`Hi ${firstName},`, ""];

  if (recap.seconds === 0) {
    lines.push(
      "You didn't log any immersion time this last week. No pressure — pick something you enjoy and hit start whenever you're ready.",
    );
  } else {
    lines.push(`You logged ${formatDuration(recap.seconds)} of Japanese immersion this last week.`);
    if (recap.previousSeconds > 0) {
      const delta = Math.round(((recap.seconds - recap.previousSeconds) / recap.previousSeconds) * 100);
      if (Math.abs(delta) >= 5) lines.push(`That's ${delta > 0 ? `${delta}% more` : `${Math.abs(delta)}% less`} than the week before.`);
    }
    if (recap.topItems.length > 0) {
      lines.push("", "What you spent the most time on:");
      for (const item of recap.topItems) lines.push(`  - ${item.title} (${formatDuration(item.seconds)})`);
    }
    if (recap.rank) lines.push("", `You're #${recap.rank} on the leaderboard this week.`);
  }

  if (recap.activeGoals.length > 0) {
    lines.push("", "Active goals:");
    for (const g of recap.activeGoals) lines.push(`  - ${g.title}: ${g.percent}%`);
  }

  lines.push(
    "",
    "Keep it up — every session counts.",
    "",
    "—",
    "Don't want these weekly emails? Unsubscribe here (this also turns off new-follower emails):",
    unsubscribeUrl,
  );

  return { subject: "Your week on immersemoar", text: lines.join("\n") };
}
