import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { resolveRanking } from "@/lib/ranking-params";
import { getLeaderboard, getUserRank } from "@/lib/ranking-queries";
import { getFollowingIds } from "@/lib/social-queries";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { CommunityTabs } from "@/components/community/community-tabs";
import { Leaderboard } from "@/components/ranking/leaderboard";
import { RankingFilters, type RankingAudience } from "@/components/ranking/ranking-filters";

export const metadata = { title: "Ranking" };

export default async function RankingPage(props: PageProps<"/ranking">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const sp = await props.searchParams;
  const r = resolveRanking({ period: str(sp.period), scope: str(sp.scope) }, tz);
  const audience: RankingAudience = str(sp.audience) === "following" ? "following" : "everyone";

  // "Following" ranks you against the people you follow — you always appear in it.
  const userIds = audience === "following" ? [...(await getFollowingIds(user.id)), user.id] : undefined;
  const opts = { from: r.range.from, to: r.range.to, types: r.types, userIds };

  const [rows, mine] = await Promise.all([getLeaderboard(opts), getUserRank(user.id, opts)]);

  return (
    <div>
      <PageHeader title="Ranking" description={`${r.range.label} · ${r.scopeLabel} · ranked by time logged`} />
      <CommunityTabs active="/ranking" />

      <div className="mb-5">
        <RankingFilters basePath="/ranking" period={r.period} scope={r.scope} audience={audience} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border bg-surface px-4 py-3 text-sm">
        {!user.publicProfile ? (
          <span className="text-muted-foreground">
            Your profile is private, so you are not ranked.{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Change in settings
            </Link>
            .
          </span>
        ) : mine.rank ? (
          <>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">Your rank</span>
              <span className="text-lg font-semibold tabular-nums">#{mine.rank}</span>
              <span className="text-xs text-muted-foreground">of {mine.total}</span>
            </span>
            <span className="tabular-nums">{formatDuration(mine.seconds)}</span>
            {mine.gapToNext != null ? (
              <span className="text-muted-foreground">
                {formatDuration(mine.gapToNext)} behind #{mine.rank - 1}
              </span>
            ) : (
              <span className="text-muted-foreground">You&rsquo;re in first place.</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">Log some time in this range to get ranked.</span>
        )}
      </div>

      <Leaderboard
        rows={rows}
        currentUserId={user.id}
        emptyText={
          audience === "following"
            ? "Nobody you follow has logged time in this range."
            : "Nobody has logged time in this range yet. Be the first."
        }
      />
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
