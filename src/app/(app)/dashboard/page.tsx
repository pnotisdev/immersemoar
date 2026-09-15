import Link from "next/link";
import { subDays, subMonths } from "date-fns";
import { dayKey, eachDayKey, presetRange } from "@/lib/dates";
import { formatDuration, relativeTime, toHours } from "@/lib/format";
import { MEDIA_TYPE_META } from "@/lib/media";
import { getGroupTotals, getProgression } from "@/lib/progression-queries";
import { getUserRank } from "@/lib/ranking-queries";
import { getMyClubStandings } from "@/lib/club-queries";
import { getDailyTotals, getGoalsWithProgress, getRecentItems, getRecentSessions, getTypeBreakdown, sumDuration } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { getActiveTimerView, getLibraryPicks } from "@/lib/view-models";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClubStandings } from "@/components/clubs/club-standings";
import { GoalCard } from "@/components/goals/goal-card";
import { LevelCard, RankCard, StreakCard } from "@/components/progression/level-card";
import { MonthCompare } from "@/components/progression/month-compare";
import { LogSessionButton } from "@/components/sessions/log-session-button";
import { QuickLogGrid } from "@/components/sessions/quick-log-grid";
import { SessionList } from "@/components/sessions/session-list";
import { toSessionView } from "@/components/sessions/types";
import { BarList } from "@/components/stats/bar-list";
import { ColumnChart } from "@/components/stats/column-chart";
import { Heatmap } from "@/components/stats/heatmap";
import { TimerCard } from "@/components/timer/timer-card";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const now = new Date();

  const today = presetRange("today", tz, now);
  const week = presetRange("week", tz, now);
  const month = presetRange("month", tz, now);
  const year = presetRange("year", tz, now);
  const last14 = presetRange("30d", tz, now);
  const heatRange = presetRange("365d", tz, now);
  // Same slice of last month (1st -> now) for a fair comparison.
  const lastMonthFrom = subMonths(month.from, 1);
  const lastMonthTo = subMonths(now, 1);

  const [picks, progression, todaySec, weekSec, yearSec, daily, heat, goals, recent, breakdown, monthTotals, lastMonthTotals, recentItems, rank, standings] =
    await Promise.all([
      getLibraryPicks(user.id),
      getProgression(user.id, tz, now),
      sumDuration(user.id, today.from, today.to),
      sumDuration(user.id, week.from, week.to),
      sumDuration(user.id, year.from, year.to),
      getDailyTotals(user.id, last14.from, last14.to, tz),
      getDailyTotals(user.id, heatRange.from, heatRange.to, tz),
      getGoalsWithProgress(user.id, tz),
      getRecentSessions(user.id, 6),
      getTypeBreakdown(user.id, month.from, month.to),
      getGroupTotals(user.id, month.from, month.to),
      getGroupTotals(user.id, lastMonthFrom, lastMonthTo),
      getRecentItems(user.id, 6),
      getUserRank(user.id, { from: month.from, to: month.to }),
      getMyClubStandings(user.id, month.from, month.to),
    ]);
  const timer = await getActiveTimerView(user.id, picks);

  const todayKey = dayKey(now, tz);
  const dayKeys14 = eachDayKey(subDays(today.from, 13), today.to, tz);
  const columns = dayKeys14.map((k) => ({
    label: k.slice(8),
    title: k,
    seconds: daily.get(k)?.seconds ?? 0,
    emphasized: k === todayKey,
  }));
  const heatDays = eachDayKey(heatRange.from, heatRange.to, tz).map((k) => ({ key: k, seconds: heat.get(k)?.seconds ?? 0 }));
  const activeGoals = goals.filter((g) => g.isActive).slice(0, 3);
  const firstName = user.name.split(" ")[0];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium tracking-widest text-muted-foreground uppercase">Welcome back</div>
          <h1 className="text-2xl font-semibold tracking-tight">{firstName}</h1>
          <p className="text-sm text-muted-foreground">
            {todaySec > 0 ? `${formatDuration(todaySec)} today` : "Nothing logged today yet"} · {formatDuration(weekSec)} this week
          </p>
        </div>
        <div className="flex gap-2">
          <Button render={<Link href="/log/new" />} nativeButton={false} variant="outline">
            Log with search
          </Button>
          <LogSessionButton entries={picks} tz={tz} />
        </div>
      </div>

      <TimerCard timer={timer} entries={picks} />

      <div className="grid gap-3 md:grid-cols-3">
        <StreakCard current={progression.currentStreak} longest={progression.longestStreak} />
        <LevelCard info={progression.overall} reading={progression.reading} listening={progression.listening} />
        <RankCard rank={rank.rank} total={rank.total} gapToNext={rank.gapToNext} isPublic={user.publicProfile ?? true} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid gap-6">
          <MonthCompare current={monthTotals} previous={lastMonthTotals} />

          <Card>
            <CardHeader>
              <CardTitle>Last 14 days</CardTitle>
              <CardDescription>
                {toHours(progression.dailyAverage)}h/day average since {progression.firstDay ?? "you started"} · {toHours(yearSec, 0)}h this year
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ColumnChart columns={columns} />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick log</CardTitle>
              <CardDescription>Recently logged media</CardDescription>
            </CardHeader>
            <CardContent>
              <QuickLogGrid items={recentItems.map((r) => ({ ...r, lastLabel: relativeTime(r.lastAt, now) }))} entries={picks} tz={tz} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Goals</CardTitle>
              <CardAction>
                <Button render={<Link href="/goals" />} nativeButton={false} variant="ghost" size="sm">
                  All goals
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              {activeGoals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active goals.{" "}
                  <Link href="/goals" className="underline underline-offset-4">
                    Set one
                  </Link>{" "}
                  — e.g. 1000 hours this year.
                </p>
              ) : (
                activeGoals.map((g) => <GoalCard key={g.id} goal={g} compact />)
              )}
            </CardContent>
          </Card>

          <ClubStandings standings={standings} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past year</CardTitle>
          <CardDescription>
            {progression.activeDays} active day{progression.activeDays === 1 ? "" : "s"} all time · {toHours(progression.totals.total, 0)}h total
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Heatmap days={heatDays} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Recent sessions</CardTitle>
            <CardAction>
              <Button render={<Link href="/log" />} nativeButton={false} variant="ghost" size="sm">
                Full log
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <SessionList sessions={recent.map(toSessionView)} entries={picks} tz={tz} groupByDay={false} emptyText="Start the timer or log a session to see it here." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This month by type</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              rows={breakdown.map((b) => ({ label: MEDIA_TYPE_META[b.mediaType].label, sublabel: `${b.count} session${b.count === 1 ? "" : "s"}`, seconds: b.seconds }))}
              emptyText="No sessions this month yet."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
