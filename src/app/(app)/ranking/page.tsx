import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { resolveRanking } from "@/lib/ranking-params";
import { getLeaderboard, getUserRank } from "@/lib/ranking-queries";
import { requireUser } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { Leaderboard } from "@/components/ranking/leaderboard";
import { RankingFilters } from "@/components/ranking/ranking-filters";

export const metadata = { title: "Ranking" };

export default async function RankingPage(props: PageProps<"/ranking">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const sp = await props.searchParams;
  const r = resolveRanking({ period: str(sp.period), scope: str(sp.scope) }, tz);
  const opts = { from: r.range.from, to: r.range.to, types: r.types };

  const [rows, mine] = await Promise.all([getLeaderboard(opts), getUserRank(user.id, opts)]);

  return (
    <div>
      <PageHeader title="Ranking" description={`${r.range.label} · ${r.scopeLabel} · ranked by logged time`} />
      <div className="mb-6">
        <RankingFilters basePath="/ranking" period={r.period} scope={r.scope} />
      </div>

      <Card className="mb-6 py-4">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 text-sm">
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
              <span>
                <span className="text-muted-foreground">Your rank</span>{" "}
                <span className="text-lg font-semibold tabular-nums">
                  #{mine.rank} <span className="text-sm font-normal text-muted-foreground">/ {mine.total}</span>
                </span>
              </span>
              <span className="tabular-nums">{formatDuration(mine.seconds)}</span>
              {mine.gapToNext != null && <span className="text-muted-foreground">{formatDuration(mine.gapToNext)} behind #{mine.rank - 1}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Log some time in this range to get ranked.</span>
          )}
        </CardContent>
      </Card>

      <Leaderboard rows={rows} currentUserId={user.id} />
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
