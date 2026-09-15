import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { formatDuration, formatNumber } from "@/lib/format";
import { MEDIA_TYPE_META, SOURCE_LABELS, UNIT_LABELS } from "@/lib/media";
import { getLibraryEntry, getMediaItem, getSessionsForItem } from "@/lib/queries";
import { getMediaCommunity } from "@/lib/social-queries";
import { requireUser } from "@/lib/session";
import { getActiveTimerView, getLibraryPicks } from "@/lib/view-models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddToLibraryButton } from "@/components/library/add-to-library-button";
import { EntryEditor } from "@/components/library/entry-editor";
import { Poster } from "@/components/media/poster";
import { Avatar } from "@/components/ranking/avatar";
import { LogSessionButton } from "@/components/sessions/log-session-button";
import { SessionList } from "@/components/sessions/session-list";
import type { SessionView } from "@/components/sessions/types";
import { StatStrip } from "@/components/stats/stat-strip";
import { TimerCard } from "@/components/timer/timer-card";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(props: PageProps<"/media/[id]">) {
  const { id } = await props.params;
  const item = UUID.test(id) ? await getMediaItem(id) : null;
  return { title: item?.title ?? "Media" };
}

export default async function MediaPage(props: PageProps<"/media/[id]">) {
  const user = await requireUser();
  const tz = user.timezone ?? "UTC";
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const item = await getMediaItem(id);
  if (!item) notFound();

  const [entry, sessions, picks, community] = await Promise.all([
    getLibraryEntry(user.id, id),
    getSessionsForItem(user.id, id),
    getLibraryPicks(user.id),
    getMediaCommunity(id),
  ]);
  const timer = await getActiveTimerView(user.id, picks);

  const totalSeconds = sessions.reduce((a, s) => a + s.durationSeconds, 0);
  const amountByUnit = new Map<string, number>();
  for (const s of sessions) if (s.amount && s.amountUnit) amountByUnit.set(s.amountUnit, (amountByUnit.get(s.amountUnit) ?? 0) + s.amount);

  const sessionViews: SessionView[] = sessions.map((s) => ({
    id: s.id,
    mediaItemId: s.mediaItemId,
    mediaType: s.mediaType,
    label: s.label,
    startedAt: s.startedAt.toISOString(),
    durationSeconds: s.durationSeconds,
    amount: s.amount,
    amountUnit: s.amountUnit,
    notes: s.notes,
    title: item.title,
    coverUrl: item.coverUrl,
  }));

  const meta = MEDIA_TYPE_META[item.type];
  const art = item.bannerUrl ?? item.coverUrl;

  return (
    <div className="grid gap-6">
      {/* Key art header: banner when the source has one, otherwise a blurred cover. */}
      <div className="-mx-4 -mt-5 sm:-mt-6">
        <div className="relative h-36 overflow-hidden rounded-b-2xl bg-muted sm:h-56">
          {art && (
            <Image
              src={art}
              alt=""
              fill
              priority
              sizes="100vw"
              className={item.bannerUrl ? "object-cover" : "scale-110 object-cover blur-xl saturate-150"}
            />
          )}
          {/* Real key art only needs enough scrim to keep the title legible; a blurred
              cover stand-in needs more, or it competes with the page. */}
          <div
            className={
              item.bannerUrl
                ? "absolute inset-0 bg-gradient-to-t from-background via-background/55 via-35% to-transparent"
                : "absolute inset-0 bg-gradient-to-t from-background via-background/75 via-30% to-background/25"
            }
          />
        </div>

        <div className="mx-auto -mt-16 flex max-w-6xl gap-4 px-4 sm:-mt-24 sm:gap-5">
          <div className="w-24 shrink-0 sm:w-36">
            <Poster src={item.coverUrl} title={item.title} type={item.type} sizes="144px" priority className="shadow-lg" />
          </div>
          <div className="min-w-0 flex-1 pt-16 sm:pt-24">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-[10px]">
                {meta.label}
              </Badge>
              {item.year && <span>{item.year}</span>}
              {item.totalAmount && item.totalUnit && (
                <span>
                  {formatNumber(item.totalAmount)} {UNIT_LABELS[item.totalUnit]}
                </span>
              )}
              {item.source !== "manual" && item.externalUrl && (
                <a
                  href={item.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {SOURCE_LABELS[item.source]} <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <h1 className="mt-1.5 text-xl font-semibold sm:text-3xl">{item.title}</h1>
            {item.titleNative && (
              <p className="text-sm text-muted-foreground sm:text-base" lang="ja">
                {item.titleNative}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!entry && <AddToLibraryButton mediaItemId={item.id} />}
        <LogSessionButton
          entries={picks}
          tz={tz}
          defaultMediaItemId={entry ? item.id : undefined}
          defaultMediaType={item.type}
          variant={entry ? "default" : "outline"}
        />
      </div>

      {item.description && (
        <p className="line-clamp-5 max-w-prose text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      )}

      {community.learners > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-surface px-4 py-3">
          <div className="flex -space-x-2">
            {community.recent.slice(0, 6).map((m) => (
              <Link key={m.userId} href={`/u/${m.userId}`} title={m.name}>
                <Avatar name={m.name} image={m.image} size="sm" className="ring-2 ring-background" />
              </Link>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{community.learners}</span> member
            {community.learners === 1 ? "" : "s"} logged {formatDuration(community.seconds)} here
            {community.avgRating != null && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{community.avgRating.toFixed(1)}</span>/10 average rating
              </>
            )}
          </p>
        </div>
      )}

      <TimerCard timer={timer} entries={picks} defaultMediaItemId={entry ? item.id : undefined} />

      <StatStrip
        stats={[
          { label: "Your time", value: formatDuration(totalSeconds), accent: totalSeconds > 0 },
          {
            label: "Sessions",
            value: sessions.length,
            hint: sessions.length ? `${formatDuration(totalSeconds / sessions.length)} average` : undefined,
          },
          ...[...amountByUnit.entries()].slice(0, 2).map(([u, n]) => ({
            label: `${UNIT_LABELS[u as keyof typeof UNIT_LABELS]} logged`,
            value: formatNumber(n),
          })),
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{entry ? "In your library" : "Not in your library"}</CardTitle>
          </CardHeader>
          <CardContent>
            {entry ? (
              <EntryEditor
                key={entry.updatedAt.toISOString()}
                entry={{
                  mediaItemId: item.id,
                  status: entry.status,
                  progress: entry.progress,
                  progressUnit: entry.progressUnit,
                  rating: entry.rating,
                  notes: entry.notes,
                  startedAt: entry.startedAt,
                  finishedAt: entry.finishedAt,
                  totalAmount: item.totalAmount,
                  totalUnit: item.totalUnit,
                  // API-sourced lengths are authoritative; only fill in when the source had none.
                  canEditTotal: item.source === "manual" ? item.createdBy === user.id : item.totalAmount == null,
                }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Add it to track status and progress.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionList sessions={sessionViews} entries={picks} tz={tz} emptyText="No time logged on this yet." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
