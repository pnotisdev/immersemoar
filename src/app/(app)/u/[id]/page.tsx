import { notFound } from "next/navigation";
import { eachDayKey, presetRange } from "@/lib/dates";
import { formatDuration, formatNumber, toHours } from "@/lib/format";
import { MEDIA_TYPE_META } from "@/lib/media";
import { getProgression } from "@/lib/progression-queries";
import { getPublicUser, getUserRank } from "@/lib/ranking-queries";
import { getDailyTotals, getTopItems, getTypeBreakdown } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LevelPill } from "@/components/progression/level-card";
import { Avatar } from "@/components/ranking/avatar";
import { BarList } from "@/components/stats/bar-list";
import { Heatmap } from "@/components/stats/heatmap";
import { StatTile } from "@/components/stats/stat-tile";

export async function generateMetadata(props: PageProps<"/u/[id]">) {
  const { id } = await props.params;
  const u = await getPublicUser(id);
  return { title: u ? u.name : "Profile" };
}

export default async function ProfilePage(props: PageProps<"/u/[id]">) {
  const viewer = await requireUser();
  const { id } = await props.params;
  const u = await getPublicUser(id);
  if (!u) notFound();

  const now = new Date();
  const tz = u.timezone; // their days, not the viewer's
  const month = presetRange("month", tz, now);
  const heatRange = presetRange("365d", tz, now);
  const all = presetRange("all", tz, now);

  const [progression, heat, breakdown, top, rank] = await Promise.all([
    getProgression(u.id, tz, now),
    getDailyTotals(u.id, heatRange.from, heatRange.to, tz),
    getTypeBreakdown(u.id, all.from, all.to),
    getTopItems(u.id, all.from, all.to, 8),
    getUserRank(u.id, { from: month.from, to: month.to }),
  ]);
  const heatDays = eachDayKey(heatRange.from, heatRange.to, tz).map((k) => ({ key: k, seconds: heat.get(k)?.seconds ?? 0 }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={u.name} image={u.image} size="xl" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {u.name}
            {u.id === viewer.id && <span className="ml-2 text-sm font-normal text-muted-foreground">(you)</span>}
          </h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <LevelPill info={progression.overall} />
            <LevelPill info={progression.reading} label="Reading" />
            <LevelPill info={progression.listening} label="Listening" />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatNumber(progression.overall.xp)} XP · tracking since {progression.firstDay ?? u.createdAt.toISOString().slice(0, 10)}
            {rank.rank && ` · #${rank.rank} this month`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total time" value={`${toHours(progression.totals.total, 0)}h`} hint={formatDuration(progression.totals.total)} />
        <StatTile label="Reading / listening" value={`${toHours(progression.totals.reading, 0)}h / ${toHours(progression.totals.listening, 0)}h`} />
        <StatTile label="Current streak" value={`${progression.currentStreak} day${progression.currentStreak === 1 ? "" : "s"}`} hint={`longest ${progression.longestStreak}`} />
        <StatTile label="Daily average" value={formatDuration(progression.dailyAverage)} hint={`${progression.activeDays} active days`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Past year</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap days={heatDays} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By media type</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList rows={breakdown.map((b) => ({ label: MEDIA_TYPE_META[b.mediaType].label, sublabel: `${b.count} session${b.count === 1 ? "" : "s"}`, seconds: b.seconds }))} emptyText="Nothing logged yet." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most time on</CardTitle>
          </CardHeader>
          <CardContent>
            <BarList rows={top.map((t) => ({ label: t.title, sublabel: MEDIA_TYPE_META[t.type].label, seconds: t.seconds, href: `/media/${t.mediaItemId}` }))} emptyText="Nothing logged yet." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
