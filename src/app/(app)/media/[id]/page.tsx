import { notFound } from "next/navigation";
import { formatDuration, formatNumber } from "@/lib/format";
import { MEDIA_TYPE_META, SOURCE_LABELS, UNIT_LABELS } from "@/lib/media";
import { getLibraryEntry, getMediaItem, getSessionsForItem } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { getActiveTimerView, getLibraryPicks } from "@/lib/view-models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddToLibraryButton } from "@/components/library/add-to-library-button";
import { EntryEditor } from "@/components/library/entry-editor";
import { LogSessionButton } from "@/components/sessions/log-session-button";
import { SessionList } from "@/components/sessions/session-list";
import type { SessionView } from "@/components/sessions/types";
import { StatTile } from "@/components/stats/stat-tile";
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

  const [entry, sessions, picks] = await Promise.all([getLibraryEntry(user.id, id), getSessionsForItem(user.id, id), getLibraryPicks(user.id)]);
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

  return (
    <div className="grid gap-6">
      <div className="flex gap-5">
        <div className="h-48 w-32 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-60 sm:w-40">
          {item.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary">{meta.label}</Badge>
            {item.year && <span className="text-sm text-muted-foreground">{item.year}</span>}
            {item.source !== "manual" && item.externalUrl && (
              <a href={item.externalUrl} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground underline underline-offset-4">
                {SOURCE_LABELS[item.source]} ↗
              </a>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{item.title}</h1>
          {item.titleNative && (
            <p className="text-lg text-muted-foreground" lang="ja">
              {item.titleNative}
            </p>
          )}
          {item.totalAmount && item.totalUnit && (
            <p className="mt-1 text-sm text-muted-foreground">
              {formatNumber(item.totalAmount)} {UNIT_LABELS[item.totalUnit]}
            </p>
          )}
          {item.description && <p className="mt-3 line-clamp-4 max-w-prose text-sm text-muted-foreground">{item.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {!entry && <AddToLibraryButton mediaItemId={item.id} />}
            <LogSessionButton entries={picks} tz={tz} defaultMediaItemId={entry ? item.id : undefined} defaultMediaType={item.type} variant={entry ? "default" : "outline"} />
          </div>
        </div>
      </div>

      <TimerCard timer={timer} entries={picks} defaultMediaItemId={entry ? item.id : undefined} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Time on this" value={formatDuration(totalSeconds)} />
        <StatTile label="Sessions" value={sessions.length} hint={sessions.length ? `${formatDuration(totalSeconds / sessions.length)} avg` : undefined} />
        {[...amountByUnit.entries()].slice(0, 2).map(([u, n]) => (
          <StatTile key={u} label={`${UNIT_LABELS[u as keyof typeof UNIT_LABELS]} logged`} value={formatNumber(n)} />
        ))}
      </div>

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
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionList sessions={sessionViews} entries={picks} tz={tz} emptyText="No time logged on this yet." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
