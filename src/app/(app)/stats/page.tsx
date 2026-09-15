import Link from "next/link";
import { Suspense } from "react";
import { differenceInCalendarDays, subMonths } from "date-fns";
import { eachDayKey, presetRange } from "@/lib/dates";
import { formatCompact, formatDuration, formatNumber, toHours } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/media";
import { xpFromSeconds } from "@/lib/progression";
import { getGroupTotals, getProgression, getReadingMetrics } from "@/lib/progression-queries";
import { getDailyTotals, getLifetimeStats, getSessionsInRange, getTopItems, getTypeBreakdown } from "@/lib/queries";
import { resolveRange } from "@/lib/range-params";
import { requireUser } from "@/lib/session";
import { SectionHeader } from "@/components/layout/page-header";
import { MonthCompare } from "@/components/progression/month-compare";
import { ColumnChart } from "@/components/stats/column-chart";
import { Heatmap } from "@/components/stats/heatmap";
import { RangePicker } from "@/components/stats/range-picker";
import { SplitBar, StatStrip } from "@/components/stats/stat-strip";
import { TopTitles } from "@/components/stats/top-titles";
import { TypeBars } from "@/components/stats/type-bars";

export const metadata = { title: "Stats" };

export default async function StatsPage(props: PageProps<"/stats">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const sp = await props.searchParams;
  const now = new Date();
  const range = resolveRange({ range: str(sp.range), from: str(sp.from), to: str(sp.to) }, tz, "month");

  const monthRange = presetRange("month", tz, now);
  const heatRange = presetRange("365d", tz, now);
  // Same slice of last month (1st -> now) so the comparison is like-for-like.
  const lastMonthFrom = subMonths(monthRange.from, 1);
  const lastMonthTo = subMonths(now, 1);

  const [daily, breakdown, top, lifetime, sessions, groups, reading, progression, heat, monthTotals, lastMonthTotals] =
    await Promise.all([
      getDailyTotals(user.id, range.from, range.to, tz),
      getTypeBreakdown(user.id, range.from, range.to),
      getTopItems(user.id, range.from, range.to, 10),
      getLifetimeStats(user.id),
      getSessionsInRange(user.id, range.from, range.to),
      getGroupTotals(user.id, range.from, range.to),
      getReadingMetrics(user.id, range.from, range.to),
      getProgression(user.id, tz, now),
      getDailyTotals(user.id, heatRange.from, heatRange.to, tz),
      getGroupTotals(user.id, monthRange.from, monthRange.to),
      getGroupTotals(user.id, lastMonthFrom, lastMonthTo),
    ]);
  const heatDays = eachDayKey(heatRange.from, heatRange.to, tz).map((k) => ({ key: k, seconds: heat.get(k)?.seconds ?? 0 }));

  const totalSeconds = [...daily.values()].reduce((a, d) => a + d.seconds, 0);
  const sessionCount = [...daily.values()].reduce((a, d) => a + d.count, 0);
  const activeDays = [...daily.values()].filter((d) => d.seconds > 0).length;

  // "All time" starts at epoch; clamp the chart to the first real session.
  const chartFrom = range.preset === "all" && lifetime.firstSession ? new Date(lifetime.firstSession) : range.from;
  const chartTo = new Date(Math.min(range.to.getTime(), now.getTime() + 86_400_000));
  const spanDays = Math.max(1, differenceInCalendarDays(chartTo, chartFrom));
  const dayKeys = eachDayKey(chartFrom, chartTo, tz);

  // Bucket by day, week, or month depending on how long the range is.
  const bucket: "day" | "week" | "month" = spanDays <= 62 ? "day" : spanDays <= 400 ? "week" : "month";
  const columns = bucketize(dayKeys, daily, bucket);

  // Native-unit totals in range (characters read, episodes watched…).
  const amounts = new Map<string, number>();
  for (const s of sessions) if (s.amount && s.amountUnit) amounts.set(s.amountUnit, (amounts.get(s.amountUnit) ?? 0) + s.amount);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  return (
    <div>
      <Suspense>
        <RangePicker current={range.preset} from={range.fromKey} to={range.toKey} />
      </Suspense>

      {/* The headline is the time itself — everything else is context for it. */}
      <div className="mt-7">
        <p className="section-label">{range.label}</p>
        <h1 className="mt-1.5 flex items-baseline gap-1 text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
          {hours}
          <span className="text-2xl font-medium text-muted-foreground sm:text-3xl">h</span>
          {minutes > 0 && (
            <>
              <span className="ml-1">{minutes}</span>
              <span className="text-2xl font-medium text-muted-foreground sm:text-3xl">m</span>
            </>
          )}
        </h1>
        <p className="mt-2.5 text-sm text-muted-foreground">
          {formatNumber(xpFromSeconds(totalSeconds))} XP · {formatNumber(sessionCount)} session
          {sessionCount === 1 ? "" : "s"} · {activeDays} active day{activeDays === 1 ? "" : "s"}
          {activeDays > 0 && <> · {formatDuration(totalSeconds / activeDays)} per active day</>}
        </p>
      </div>

      <div className="mt-6">
        {columns.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nothing logged in this range.</p>
        ) : (
          <ColumnChart columns={columns} height={190} />
        )}
      </div>

      <StatStrip
        className="mt-8"
        stats={[
          {
            label: "Daily average",
            value: formatDuration(progression.dailyAverage),
            hint: progression.firstDay ? `since ${progression.firstDay}` : undefined,
          },
          { label: "Current streak", value: `${progression.currentStreak}d`, hint: "consecutive days" },
          { label: "Longest streak", value: `${progression.longestStreak}d`, hint: "all time" },
          { label: "All time", value: `${toHours(lifetime.seconds, 0)}h`, hint: `${formatNumber(lifetime.count)} sessions` },
        ]}
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionHeader title="What you spent it on" />
          <TopTitles
            items={top.map((t) => ({ ...t, detail: `${t.count} session${t.count === 1 ? "" : "s"}` }))}
            emptyText="No sessions tied to a library item in this range."
          />
        </section>

        <section>
          <SectionHeader title="Reading vs listening" />
          <SplitBar
            segments={[
              { label: "Reading", seconds: groups.reading, color: "bg-amber-500" },
              { label: "Listening", seconds: groups.listening, color: "bg-teal-500" },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {toHours(groups.reading)}h reading · {toHours(groups.listening)}h listening
          </p>
          <div className="mt-7">
            <SectionHeader title="By medium" />
            <TypeBars rows={breakdown} />
          </div>
        </section>
      </div>

      {(reading.characters > 0 || reading.pages > 0) && (
        <section className="mt-10">
          <SectionHeader title="Reading metrics" />
          <StatStrip
            stats={[
              {
                label: "Reading speed",
                value: reading.charsPerHour ? formatCompact(reading.charsPerHour) : "—",
                hint: "chars per hour",
              },
              { label: "Characters", value: formatCompact(reading.characters), hint: formatNumber(reading.characters) },
              { label: "Pages", value: formatNumber(reading.pages) },
              {
                label: "Chars per active day",
                value: activeDays && reading.characters ? formatCompact(Math.round(reading.characters / activeDays)) : "—",
              },
            ]}
          />
        </section>
      )}

      {amounts.size > 0 && (
        <section className="mt-10">
          <SectionHeader title="Amounts logged" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-5 sm:grid-cols-4">
            {[...amounts.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([unit, n]) => (
                <div key={unit}>
                  <dt className="section-label">{UNIT_LABELS[unit as keyof typeof UNIT_LABELS]}</dt>
                  <dd className="mt-1 text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl">
                    {formatCompact(n)}
                  </dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      <section className="mt-10">
        <SectionHeader title="This month vs last" />
        <MonthCompare current={monthTotals} previous={lastMonthTotals} />
      </section>

      <section className="mt-10">
        <SectionHeader
          title="Past year"
          action={
            <Link href="/stats?range=all" className="text-xs text-muted-foreground hover:text-foreground">
              All time
            </Link>
          }
        />
        <Heatmap days={heatDays} />
        <p className="mt-3 text-xs text-muted-foreground">
          {progression.activeDays} active days all time · tracking since{" "}
          {lifetime.firstSession ? String(lifetime.firstSession).slice(0, 10) : "—"}
        </p>
      </section>
    </div>
  );
}

function bucketize(dayKeys: string[], daily: Map<string, { seconds: number }>, bucket: "day" | "week" | "month") {
  if (bucket === "day") {
    return dayKeys.map((k) => ({ label: k.slice(8), title: k, seconds: daily.get(k)?.seconds ?? 0 }));
  }
  const out: { label: string; title: string; seconds: number }[] = [];
  let current: { key: string; label: string; title: string; seconds: number } | null = null;
  for (const k of dayKeys) {
    const d = new Date(k + "T00:00:00Z");
    let key: string;
    let label: string;
    let title: string;
    if (bucket === "week") {
      const dow = (d.getUTCDay() + 6) % 7;
      const mon = new Date(d);
      mon.setUTCDate(d.getUTCDate() - dow);
      key = mon.toISOString().slice(0, 10);
      label = key.slice(5);
      title = `Week of ${key}`;
    } else {
      key = k.slice(0, 7);
      label = new Date(k + "T00:00:00Z").toLocaleString("en", { month: "short", timeZone: "UTC" });
      title = key;
    }
    if (!current || current.key !== key) {
      current = { key, label, title, seconds: 0 };
      out.push(current);
    }
    current.seconds += daily.get(k)?.seconds ?? 0;
  }
  return out;
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
