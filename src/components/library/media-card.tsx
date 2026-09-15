import Link from "next/link";
import type { EntryStatus, MediaType, Unit } from "@/db/schema";
import { formatCompact } from "@/lib/format";
import { MEDIA_TYPE_META, STATUS_LABELS, UNIT_LABELS } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Poster } from "@/components/media/poster";

export interface MediaCardData {
  mediaItemId: string;
  title: string;
  titleNative: string | null;
  coverUrl: string | null;
  type: MediaType;
  status: EntryStatus;
  progress: number;
  progressUnit: Unit | null;
  totalAmount: number | null;
  totalUnit: Unit | null;
  rating?: number | null;
}

/** Status is a dot, not a badge — the shelf should read as artwork first. */
const STATUS_DOT: Record<EntryStatus, string> = {
  active: "bg-emerald-500",
  planning: "bg-sky-400",
  paused: "bg-amber-500",
  finished: "bg-primary",
  dropped: "bg-muted-foreground/60",
};

/** A library shelf tile: cover, progress along the bottom edge, title underneath. */
export function MediaCard({ item }: { item: MediaCardData }) {
  const hasTotal = Boolean(item.totalAmount && item.totalUnit && item.totalUnit === item.progressUnit);
  const pct = hasTotal ? Math.min(100, (item.progress / item.totalAmount!) * 100) : null;

  return (
    <Link href={`/media/${item.mediaItemId}`} className="group block">
      <div className="relative">
        <Poster src={item.coverUrl} title={item.title} type={item.type} sizes="(max-width: 640px) 33vw, 180px" />

        <span
          className={cn("absolute top-1.5 left-1.5 size-2 rounded-full ring-2 ring-black/25", STATUS_DOT[item.status])}
          title={STATUS_LABELS[item.status]}
        />
        {item.rating != null && (
          <span className="absolute top-1.5 right-1.5 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
            {item.rating}
          </span>
        )}

        {pct != null && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>

      <p className="mt-1.5 line-clamp-2 text-xs leading-snug font-medium group-hover:text-primary">{item.title}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        {item.progressUnit && (item.progress > 0 || hasTotal) ? (
          <>
            {formatCompact(item.progress)}
            {hasTotal && ` / ${formatCompact(item.totalAmount!)}`} {UNIT_LABELS[item.progressUnit]}
          </>
        ) : (
          MEDIA_TYPE_META[item.type].label
        )}
      </p>
    </Link>
  );
}
