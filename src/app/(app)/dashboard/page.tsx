import Link from "next/link";
import { subDays } from "date-fns";
import { dayKey, eachDayKey, presetRange } from "@/lib/dates";
import { formatDuration, formatNumber, relativeTime, toHours } from "@/lib/format";
import { getProgression } from "@/lib/progression-queries";
import { getUserRank } from "@/lib/ranking-queries";
import { getMyClubStandings } from "@/lib/club-queries";
import { getDailyTotals, getGoalsWithProgress, getRecentItems, getRecentSessions, sumDuration } from "@/lib/queries";
import { getFeed } from "@/lib/social-queries";
import { requireUser } from "@/lib/session";
import { getActiveTimerView, getLibraryPicks } from "@/lib/view-models";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/layout/page-header";
import { ActivityFeed } from "@/components/community/activity-feed";
import { ClubStandings } from "@/components/clubs/club-standings";
import { GoalCard } from "@/components/goals/goal-card";
import { QuickLogGrid } from "@/components/sessions/quick-log-grid";
import { SessionList } from "@/components/sessions/session-list";
import { toSessionView } from "@/components/sessions/types";
import { ColumnChart } from "@/components/stats/column-chart";
import { StatStrip } from "@/components/stats/stat-strip";
import { TimerCard } from "@/components/timer/timer-card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const now = new Date();

  const today = presetRange("today", tz, now);
  const week = presetRange("week", tz, now);
  const month = presetRange("month", tz, now);
  const last30 = presetRange("30d", tz, now);

  const [picks, progression, todaySec, weekSec, daily, goals, recent, recentItems, rank, standings, friends] =
    await Promise.all([
      getLibraryPicks(user.id),
      getProgression(user.id, tz, now),
      sumDuration(user.id, today.from, today.to),
      sumDuration(user.id, week.from, week.to),
      getDailyTotals(user.id, last30.from, last30.to, tz),
      getGoalsWithProgress(user.id, tz),
      getRecentSessions(user.id, 5),
      getRecentItems(user.id, 6),
      getUserRank(user.id, { from: month.from, to: month.to }),
      getMyClubStandings(user.id, month.from, month.to),
      getFeed(user.id, { scope: "following", limit: 6 }),
    ]);
  const timer = await getActiveTimerView(user.id, picks);

  const todayKey = dayKey(now, tz);
  const columns = eachDayKey(subDays(today.from, 13), today.to, tz).map((k) => ({
    label: k.slice(8),
    title: k,
    seconds: daily.get(k)?.seconds ?? 0,
    emphasized: k === todayKey,
  }));
  const activeGoals = goals.filter((g) => g.isActive).slice(0, 2);
  const firstName = user.name.split(" ")[0];
  // Your own sessions are in this feed too; only show it when someone else is in it.
  const friendItems = friends.items.filter((i) => i.userId !== user.id).slice(0, 5);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">
          {greeting(now, tz)}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {todaySec > 0 ? `${formatDuration(todaySec)} today` : "Nothing logged today yet"} ·{" "}
          {formatDuration(weekSec)} this week · {toHours(progression.dailyAverage)}h/day average
        </p>
      </div>

      <TimerCard timer={timer} entries={picks} />

      <div>
        <StatStrip
          stats={[
            {
              label: "Streak",
              value: `${progression.currentStreak}d`,
              hint:
                progression.currentStreak > 0
                  ? `longest ${progression.longestStreak} day${progression.longestStreak === 1 ? "" : "s"}`
                  : "log today to start one",
              accent: progression.currentStreak > 0,
            },
            { label: "Level", value: progression.overall.level, hint: `${formatNumber(progression.overall.xp)} XP` },
            {
              label: "Monthly rank",
              value: rank.rank ? `#${rank.rank}` : "—",
              hint: !user.publicProfile ? "profile is private" : rank.rank ? `of ${rank.total} · ${rank.gapToNext != null ? `${formatDuration(rank.gapToNext)} behind #${rank.rank - 1}` : "first place"}` : "log time to be ranked",
            },
            { label: "This week", value: formatDuration(weekSec), hint: `${toHours(progression.totals.total, 0)}h all time` },
          ]}
        />
        {/* Level progress reads better as one line across the page than as a card. */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Lv {progression.overall.level}</span>
            <span>
              {formatNumber(progression.overall.xpForNext - progression.overall.xpIntoLevel)} XP to Lv{" "}
              {progression.overall.level + 1}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--viz-seq-0)]">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, progression.overall.percent)}%` }} />
          </div>
        </div>
      </div>

      <section>
        <SectionHeader
          title="Pick up where you left off"
          action={
            <Link href="/library" className="text-xs text-muted-foreground hover:text-foreground">
              Library
            </Link>
          }
        />
        <QuickLogGrid items={recentItems.map((r) => ({ ...r, lastLabel: relativeTime(r.lastAt, now) }))} entries={picks} tz={tz} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionHeader
            title="Last 14 days"
            action={
              <Link href="/stats" className="text-xs text-muted-foreground hover:text-foreground">
                All stats
              </Link>
            }
          />
          <ColumnChart columns={columns} />
        </section>

        <section>
          <SectionHeader
            title="Goals"
            action={
              <Link href="/goals" className="text-xs text-muted-foreground hover:text-foreground">
                All goals
              </Link>
            }
          />
          {activeGoals.length === 0 ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">
                No active goals.{" "}
                <Link href="/goals" className="underline underline-offset-4">
                  Set one
                </Link>{" "}
                — 1000 hours this year, 2M characters this month, anything.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {activeGoals.map((g) => (
                <GoalCard key={g.id} goal={g} compact />
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionHeader
            title="Recent sessions"
            action={
              <Link href="/log" className="text-xs text-muted-foreground hover:text-foreground">
                Full log
              </Link>
            }
          />
          <SessionList
            sessions={recent.map(toSessionView)}
            entries={picks}
            tz={tz}
            groupByDay={false}
            emptyText="Start the timer or log a session to see it here."
          />
        </section>

        <section>
          <SectionHeader
            title={friendItems.length > 0 ? "From people you follow" : "Community"}
            action={
              <Link href="/community" className="text-xs text-muted-foreground hover:text-foreground">
                Activity
              </Link>
            }
          />
          {friendItems.length > 0 ? (
            <ActivityFeed items={friendItems} viewerId={user.id} />
          ) : (
            <Card>
              <CardContent className="text-sm text-muted-foreground">
                Follow a few members and their sessions show up here.{" "}
                <Link href="/members" className="underline underline-offset-4">
                  Browse members
                </Link>
                .
              </CardContent>
            </Card>
          )}
          <div className="mt-6">
            <ClubStandings standings={standings} />
          </div>
        </section>
      </div>
    </div>
  );
}

/** Greets in the user's own timezone, not the server's. */
function greeting(now: Date, tz: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(now));
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
