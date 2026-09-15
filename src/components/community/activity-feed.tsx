import Link from "next/link";
import { formatCompact, formatDuration, relativeTime } from "@/lib/format";
import { MEDIA_TYPE_META, activityVerb, unitLabel } from "@/lib/media";
import type { FeedItem } from "@/lib/social-queries";
import { Avatar } from "@/components/ranking/avatar";
import { Thumb } from "@/components/media/poster";
import { KudosButton } from "./kudos-button";

/** One session, told as a sentence: who, what they did, how much, how long ago. */
function FeedRow({ item, viewerId, now }: { item: FeedItem; viewerId: string; now: Date }) {
  const what = item.title ?? item.label ?? MEDIA_TYPE_META[item.mediaType].label;
  const amount =
    item.amount && item.amountUnit ? `${formatCompact(item.amount)} ${unitLabel(item.amountUnit, item.amount)}` : null;

  return (
    <li className="flex gap-3 py-3.5">
      <Link href={`/u/${item.userId}`} className="shrink-0">
        <Avatar name={item.name} image={item.image} size="md" />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <Link href={`/u/${item.userId}`} className="font-medium hover:underline">
            {item.name}
          </Link>{" "}
          <span className="text-muted-foreground">{activityVerb(item.mediaType)}</span>{" "}
          {item.mediaItemId ? (
            <Link href={`/media/${item.mediaItemId}`} className="font-medium hover:underline">
              {what}
            </Link>
          ) : (
            <span className="font-medium">{what}</span>
          )}
        </p>

        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80 tabular-nums">{formatDuration(item.durationSeconds)}</span>
          {amount && <> · {amount}</>} · {MEDIA_TYPE_META[item.mediaType].label} · {relativeTime(item.startedAt, now)}
        </p>

        {item.notes && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground italic">“{item.notes}”</p>}

        <div className="mt-1.5">
          <KudosButton
            sessionId={item.sessionId}
            initialCount={item.kudos}
            initialGiven={item.kudosByViewer}
            disabled={item.userId === viewerId}
          />
        </div>
      </div>

      {item.mediaItemId && (
        <Link href={`/media/${item.mediaItemId}`} className="shrink-0">
          <Thumb src={item.coverUrl} title={what} />
        </Link>
      )}
    </li>
  );
}

export function ActivityFeed({
  items,
  viewerId,
  emptyText = "Nothing here yet.",
  emptyAction,
}: {
  items: FeedItem[];
  viewerId: string;
  emptyText?: string;
  emptyAction?: React.ReactNode;
}) {
  const now = new Date();
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
        {emptyAction && <div className="mt-3 flex justify-center">{emptyAction}</div>}
      </div>
    );
  }
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <FeedRow key={item.sessionId} item={item} viewerId={viewerId} now={now} />
      ))}
    </ul>
  );
}
