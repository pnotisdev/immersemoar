import Link from "next/link";
import { Suspense } from "react";
import { differenceInCalendarDays } from "date-fns";
import { eachDayKey } from "@/lib/dates";
import { formatCompact, formatDuration, formatNumber, toHours } from "@/lib/format";
import { MEDIA_TYPE_META, UNIT_LABELS } from "@/lib/media";
import { xpFromSeconds } from "@/lib/progression";
import { getGroupTotals, getProgression, getReadingMetrics } from "@/lib/progression-queries";
import { getDailyTotals, getLifetimeStats, getSessionsInRange, getTopItems, getTypeBreakdown } from "@/lib/queries";
import { resolveRange } from "@/lib/range-params";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { BarList } from "@/components/stats/bar-list";
import { ColumnChart } from "@/components/stats/column-chart";
import { RangePicker } from "@/components/stats/range-picker";
import { StatTile } from "@/components/stats/stat-tile";

export const metadata = { title: "Stats" };

export default async function StatsPage(props: PageProps<"/stats">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const sp = await props.searchParams;
  const now = new Date();
  const range = resolveRange({ range: str(sp.range), from: str(sp.from), to: str(sp.to) }, tz, "month");

  const [daily, breakdown, top, lifetime, sessions, groups, reading, progression] = await Promise.all([
    getDailyTotals(user.id, range.from, range.to, tz),
    getTypeBreakdown(user.id, range.from, range.to),
    getTopItems(user.id, range.from, range.to, 10),
    getLifetimeStats(user.id),
    getSessionsInRange(user.id, range.from, range.to),
    getGroupTotals(user.id, range.from, range.to),
    getReadingMetrics(user.id, range.from, range.to),
    getProgression(user.id, tz, now),
  ]);

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

  return (
    <div>
      <PageHeader title="Stats" description={range.label} />
      <div className="mb-6">
        <Suspense>
          <RangePicker current={range.preset} from={range.fromKey} to={range.toKey} />
        </Suspense>
      </div>

      <Section title="Totals">
        <StatTile label="XP earned" value={formatNumber(xpFromSeconds(totalSeconds))} hint="1 XP per minute" />
        <StatTile label="Time spent" value={formatDuration(totalSeconds)} hint={`${toHours(totalSeconds)} hours`} />
        <StatTile label="Sessions" value={sessionCount} hint={sessionCount ? `${formatDuration(totalSeconds / sessionCount)} avg` : undefined} />
        <StatTile label="Active days" value={activeDays} hint={range.preset === "all" ? undefined : `of ${Math.min(spanDays, dayKeys.length)}`} />
      </Section>

      <Section title="Daily habit & streaks">
        <StatTile label="Per active day" value={activeDays ? formatDuration(totalSeconds / activeDays) : "—"} hint="in this range" />
        <StatTile label="Daily average" value={formatDuration(progression.dailyAverage)} hint={progression.firstDay ? `every day since ${progression.firstDay}` : undefined} />
        <StatTile label="Current streak" value={`${progression.currentStreak} day${progression.currentStreak === 1 ? "" : "s"}`} hint="consecutive days with a session" />
        <StatTile label="Longest streak" value={`${progression.longestStreak} day${progression.longestStreak === 1 ? "" : "s"}`} hint="all time" />
      </Section>

      <Section title="Reading vs listening" cols={3}>
        <StatTile label="Reading" value={`${toHours(groups.reading)}h`} hint="manga, novels, VNs, books, news" />
        <StatTile label="Listening" value={`${toHours(groups.listening)}h`} hint="anime, video, movies, podcasts" />
        <StatTile label="Balance" value={balance(groups.reading, groups.listening)} hint="reading : listening" />
      </Section>

      <Section title="Reading metrics">
        <StatTile label="Reading speed" value={reading.charsPerHour ? formatNumber(reading.charsPerHour) : "—"} hint="chars/hour, from sessions with a character count" />
        <StatTile label="Characters read" value={formatCompact(reading.characters)} hint={reading.characters ? formatNumber(reading.characters) : "log characters with VN/book sessions"} />
        <StatTile label="Pages" value={formatNumber(reading.pages)} />
        <StatTile label="Chars per active day" value={activeDays && reading.characters ? formatCompact(Math.round(reading.characters / activeDays)) : "—"} />
      </Section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Time per {bucket}</CardTitle>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? <p className="text-sm text-muted-foreground">Nothing in this range.</p> : <ColumnChart columns={columns} height={200} />}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By media type</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              rows={breakdown.map((b) => ({
                label: MEDIA_TYPE_META[b.mediaType].label,
                sublabel: `${b.count} session${b.count === 1 ? "" : "s"} · ${Math.round((b.seconds / Math.max(1, totalSeconds)) * 100)}%`,
                seconds: b.seconds,
              }))}
              emptyText="Nothing in this range."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top items</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList
              rows={top.map((t) => ({
                label: t.title,
                sublabel: MEDIA_TYPE_META[t.type].label,
                seconds: t.seconds,
                href: `/media/${t.mediaItemId}`,
              }))}
              emptyText="No sessions tied to library items in this range."
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Amounts</CardTitle>
          </CardHeader>
          <CardContent>
            {amounts.size === 0 ? (
              <p className="text-sm text-muted-foreground">Log amounts (episodes, pages, characters…) with sessions to see totals here.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[...amounts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([u, n]) => (
                    <div key={u}>
                      <dt className="text-xs text-muted-foreground">{UNIT_LABELS[u as keyof typeof UNIT_LABELS]}</dt>
                      <dd className="text-xl font-semibold tracking-tight">{formatCompact(n)}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All time</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="text-xl font-semibold tracking-tight">{toHours(lifetime.seconds, 0)}h</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Sessions</dt>
                <dd className="text-xl font-semibold tracking-tight">{lifetime.count}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tracking since</dt>
                <dd className="text-xl font-semibold tracking-tight">{lifetime.firstSession ? String(lifetime.firstSession).slice(0, 10) : "—"}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              <Link href="/stats?range=all" className="underline underline-offset-4">
                View all time
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Section({ title, cols = 4, children }: { title: string; cols?: 3 | 4; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">{title}</h2>
      <div className={cols === 3 ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : "grid grid-cols-2 gap-3 lg:grid-cols-4"}>{children}</div>
    </section>
  );
}

/** "4 : 6" style ratio normalised to ten parts. */
function balance(reading: number, listening: number) {
  const total = reading + listening;
  if (total === 0) return "—";
  const r = Math.round((reading / total) * 10);
  return `${r} : ${10 - r}`;
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
