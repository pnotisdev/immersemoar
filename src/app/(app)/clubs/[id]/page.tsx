import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Lock, Users } from "lucide-react";
import { presetRange } from "@/lib/dates";
import { formatDuration } from "@/lib/format";
import { getClub, getClubLeaderboard, getClubPicks, getMembership } from "@/lib/club-queries";
import { PERIOD_LABELS, RANKING_PERIODS, type RankingPeriod } from "@/lib/ranking-params";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getLibraryPicks } from "@/lib/view-models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditClubButton, JoinLeaveButton } from "@/components/clubs/club-dialogs";
import { ClubPicks } from "@/components/clubs/club-picks";
import { JoinCode } from "@/components/clubs/join-code";
import { Avatar } from "@/components/ranking/avatar";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/clubs/[id]">) {
  const { id } = await props.params;
  const club = UUID.test(id) ? await getClub(id) : null;
  return { title: club?.name ?? "Club" };
}

export default async function ClubPage(props: PageProps<"/clubs/[id]">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();
  const sp = await props.searchParams;
  const period = (RANKING_PERIODS as readonly string[]).includes(str(sp.period) ?? "") ? (str(sp.period) as RankingPeriod) : "month";

  const club = await getClub(id);
  if (!club) notFound();
  const membership = await getMembership(id, user.id);
  const isMember = Boolean(membership);
  const isOwner = club.ownerId === user.id;
  // Private clubs are invisible to non-members (except by join code). A club an
  // admin has hidden (see /admin) gets the same treatment for non-members.
  if ((club.visibility === "private" || club.hidden) && !isMember) notFound();

  const range = presetRange(period, tz);
  const [board, picks, library] = await Promise.all([getClubLeaderboard(id, range.from, range.to), isMember ? getClubPicks(id, user.id) : [], isMember ? getLibraryPicks(user.id) : []]);

  return (
    <div className="grid gap-6">
      <div className="overflow-hidden rounded-xl border">
        <div className="relative h-32 bg-muted sm:h-40">
          {club.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex flex-wrap items-start gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{club.name}</h1>
              <Badge variant="outline" className="gap-1">
                {club.visibility === "private" ? <Lock className="size-3" /> : <Globe className="size-3" />}
                {club.visibility === "private" ? "Private" : "Public"}
              </Badge>
            </div>
            {club.description && <p className="mt-1 max-w-prose text-sm text-muted-foreground">{club.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="size-3.5" /> {club.members.length}/100 members
              </span>
              {club.tags.map((t) => (
                <Link key={t} href={`/clubs?tag=${t}`}>
                  <Badge variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOwner && (
              <EditClubButton
                clubId={club.id}
                initial={{ name: club.name, description: club.description ?? "", visibility: club.visibility, tags: club.tags as never, coverUrl: club.coverUrl ?? "" }}
              />
            )}
            <JoinLeaveButton clubId={club.id} isMember={isMember} isOwner={isOwner} visibility={club.visibility} />
          </div>
        </div>
        {isOwner && (
          <div className="border-t px-4 py-3">
            <JoinCode clubId={club.id} code={club.joinCode} />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Club ranking</CardTitle>
            <CardDescription>Members ranked by logged time · {range.label}</CardDescription>
            <div className="mt-2 flex w-fit flex-wrap gap-1 rounded-lg border p-1">
              {RANKING_PERIODS.map((p) => (
                <Link key={p} href={p === "month" ? `/clubs/${club.id}` : `/clubs/${club.id}?period=${p}`} className={cn("rounded-md px-2.5 py-1 text-sm", period === p ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
                  {PERIOD_LABELS[p]}
                </Link>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-1">
              {board.map((r) => (
                <li key={r.userId} className={cn("flex items-center gap-3 rounded-md px-2 py-1.5", r.userId === user.id && "bg-[var(--viz-series-track)]/40")}>
                  <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">{r.rank}</span>
                  <Avatar name={r.name} image={r.image} size="sm" />
                  <Link href={`/u/${r.username}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
                    {r.name}
                    {r.userId === club.ownerId && <span className="ml-1 text-xs font-normal text-muted-foreground">owner</span>}
                  </Link>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] tabular-nums">Lv {r.level.level}</span>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums">{formatDuration(r.seconds)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What we&apos;re consuming</CardTitle>
            <CardDescription>Propose, vote, and the owner picks the winner.</CardDescription>
          </CardHeader>
          <CardContent>
            {isMember ? (
              <ClubPicks clubId={club.id} picks={picks} library={library} viewerId={user.id} isOwner={isOwner} isMember={isMember} />
            ) : (
              <p className="text-sm text-muted-foreground">Join the club to see and vote on picks.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function str(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
