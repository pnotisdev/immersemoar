import Link from "next/link";
import { notFound } from "next/navigation";
import { eachDayKey, presetRange } from "@/lib/dates";
import { formatDuration, formatNumber, toHours } from "@/lib/format";
import { getProgression } from "@/lib/progression-queries";
import { getDailyTotals, getLibrary, getTopItems, getTypeBreakdown } from "@/lib/queries";
import { getPublicUser, getUserRank } from "@/lib/ranking-queries";
import { getFeed, getFollowCounts, isFollowing, listFollowConnections } from "@/lib/social-queries";
import { requireUser } from "@/lib/session";
import { USERNAME_RE } from "@/lib/username";
import { SectionHeader } from "@/components/layout/page-header";
import { ActivityFeed } from "@/components/community/activity-feed";
import { FollowButton } from "@/components/community/follow-button";
import { MediaCard } from "@/components/library/media-card";
import { ArtBanner } from "@/components/media/art-banner";
import { ScrollRail } from "@/components/media/scroll-rail";
import { LevelPill } from "@/components/progression/level-card";
import { Avatar } from "@/components/ranking/avatar";
import { Heatmap } from "@/components/stats/heatmap";
import { SplitBar, StatStrip } from "@/components/stats/stat-strip";
import { TypeBars } from "@/components/stats/type-bars";
import { TopTitles } from "@/components/stats/top-titles";

export async function generateMetadata(props: PageProps<"/u/[username]">) {
  const { username } = await props.params;
  const u = USERNAME_RE.test(username) ? await getPublicUser(username) : null;
  return { title: u ? u.name : "Profile" };
}

export default async function ProfilePage(props: PageProps<"/u/[username]">) {
  const viewer = await requireUser();
  const { username } = await props.params;
  // Cheap guard so an obviously-malformed handle 404s before hitting the database.
  if (!USERNAME_RE.test(username)) notFound();
  const u = await getPublicUser(username);
  if (!u) notFound();

  const isSelf = u.id === viewer.id;
  const now = new Date();
  const tz = u.timezone; // their days, not the viewer's
  const month = presetRange("month", tz, now);
  const heatRange = presetRange("365d", tz, now);
  const all = presetRange("all", tz, now);

  const [progression, heat, breakdown, top, rank, counts, following, feed, library, followers] = await Promise.all([
    getProgression(u.id, tz, now),
    getDailyTotals(u.id, heatRange.from, heatRange.to, tz),
    getTypeBreakdown(u.id, all.from, all.to),
    getTopItems(u.id, all.from, all.to, 10),
    getUserRank(u.id, { from: month.from, to: month.to }),
    getFollowCounts(u.id),
    isSelf ? Promise.resolve(false) : isFollowing(viewer.id, u.id),
    getFeed(viewer.id, { ofUser: u.id, limit: 10 }),
    getLibrary(u.id),
    listFollowConnections(u.id, "followers", 10),
  ]);

  const heatDays = eachDayKey(heatRange.from, heatRange.to, tz).map((k) => ({ key: k, seconds: heat.get(k)?.seconds ?? 0 }));
  const active = library.filter((e) => e.status === "active");
  const finished = library
    .filter((e) => e.status === "finished")
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""));
  // The header art is whatever they've sunk the most hours into.
  const heroArt = top.map((t) => t.bannerUrl ?? t.coverUrl).filter((x): x is string => Boolean(x));
  const firstName = u.name.split(" ")[0];

  const card = (e: (typeof library)[number]) => ({
    mediaItemId: e.mediaItemId,
    title: e.mediaItem.title,
    titleNative: e.mediaItem.titleNative,
    coverUrl: e.mediaItem.coverUrl,
    type: e.mediaItem.type,
    status: e.status,
    progress: e.progress,
    progressUnit: e.progressUnit,
    totalAmount: e.mediaItem.totalAmount,
    totalUnit: e.mediaItem.totalUnit,
    rating: e.rating,
  });

  const action = isSelf ? (
    <Link href="/settings" className="rounded-full border px-3.5 py-1.5 text-xs transition-colors hover:bg-muted">
      Edit profile
    </Link>
  ) : (
    <FollowButton userId={u.id} initialFollowing={following} />
  );

  return (
    <div>
      {/* Header art comes from what they actually watch and read. */}
      <div className="-mx-4 -mt-5 sm:-mt-6">
        <ArtBanner images={heroArt} />
        {/* relative: the banner's scrim is absolutely positioned and would paint over this row.
            Phones stack avatar → name → pills; from sm the name sits beside the avatar. */}
        <div className="relative z-10 -mt-12 flex flex-col gap-3 px-4 sm:-mt-14 sm:flex-row sm:items-end sm:gap-4">
          <div className="flex items-end justify-between gap-3">
            <Avatar name={u.name} image={u.image} size="xl" className="ring-4 ring-background" />
            <div className="sm:hidden">{action}</div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {u.name}
              {isSelf && <span className="ml-2 align-middle text-sm font-normal text-muted-foreground">you</span>}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <LevelPill info={progression.overall} />
              <LevelPill info={progression.reading} label="Reading" />
              <LevelPill info={progression.listening} label="Listening" />
            </div>
          </div>
          <div className="hidden sm:block">{action}</div>
        </div>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{formatNumber(counts.followers)}</span> followers
        </span>
        <span>
          <span className="font-medium text-foreground">{formatNumber(counts.following)}</span> following
        </span>
        <span>
          <span className="font-medium text-foreground">{formatNumber(progression.overall.xp)}</span> XP
        </span>
        {rank.rank && (
          <Link href="/ranking" className="hover:text-foreground">
            #{rank.rank} this month
          </Link>
        )}
        <span>tracking since {progression.firstDay ?? u.createdAt.toISOString().slice(0, 10)}</span>
      </p>

      {followers.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {followers.slice(0, 8).map((f) => (
              <Link key={f.userId} href={`/u/${f.username}`} title={f.name}>
                <Avatar name={f.name} image={f.image} size="sm" className="ring-2 ring-background" />
              </Link>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">follow {isSelf ? "you" : firstName}</span>
        </div>
      )}

      <StatStrip
        className="mt-7"
        stats={[
          {
            label: "Time immersed",
            value: `${toHours(progression.totals.total, 0)}h`,
            hint: formatDuration(progression.totals.total),
            accent: true,
          },
          { label: "Current streak", value: `${progression.currentStreak}d`, hint: `longest ${progression.longestStreak} day${progression.longestStreak === 1 ? "" : "s"}` },
          { label: "Daily average", value: formatDuration(progression.dailyAverage), hint: `${progression.activeDays} active days` },
          { label: "Titles tracked", value: formatNumber(library.length), hint: `${finished.length} finished` },
        ]}
      />

      {active.length > 0 && (
        <section className="mt-9">
          <SectionHeader title={isSelf ? "You're immersing in" : `${firstName} is immersing in`} />
          <ScrollRail label="Currently immersing in">
            {active.slice(0, 16).map((e) => (
              <div key={e.id} className="w-28 shrink-0 sm:w-32">
                <MediaCard item={card(e)} />
              </div>
            ))}
          </ScrollRail>
        </section>
      )}

      <div className="mt-9 grid gap-9 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section>
          <SectionHeader title="Most time spent on" />
          <TopTitles
            items={top.map((t) => ({ ...t, detail: `${t.count} session${t.count === 1 ? "" : "s"}` }))}
            emptyText="No sessions logged yet."
          />
        </section>

        <section>
          <SectionHeader title="How they immerse" />
          <SplitBar
            segments={[
              { label: "Reading", seconds: progression.totals.reading, color: "bg-amber-500" },
              { label: "Listening", seconds: progression.totals.listening, color: "bg-teal-500" },
            ]}
          />
          <div className="mt-5">
            <TypeBars rows={breakdown} limit={6} />
          </div>
        </section>
      </div>

      {finished.length > 0 && (
        <section className="mt-9">
          <SectionHeader
            title="Finished"
            action={<span className="text-xs text-muted-foreground">{finished.length} titles</span>}
          />
          <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
            {finished.slice(0, 12).map((e) => (
              <MediaCard key={e.id} item={card(e)} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-9">
        <SectionHeader
          title="Past year"
          action={
            <span className="text-xs text-muted-foreground">
              {progression.activeDays} active days · {toHours(progression.totals.total, 0)}h total
            </span>
          }
        />
        <Heatmap days={heatDays} />
      </section>

      <section className="mt-9">
        <SectionHeader title="Recent sessions" />
        <ActivityFeed
          items={feed.items}
          viewerId={viewer.id}
          emptyText={isSelf ? "You haven't logged anything yet." : `${u.name} hasn't logged anything yet.`}
        />
      </section>
    </div>
  );
}
