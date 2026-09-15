import Link from "next/link";
import type { EntryStatus, MediaType, Unit } from "@/db/schema";
import { formatCompact } from "@/lib/format";
import { MEDIA_TYPE_META, STATUS_LABELS, UNIT_LABELS } from "@/lib/media";
import { Badge } from "@/components/ui/badge";

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
}

export function MediaCard({ item }: { item: MediaCardData }) {
  const hasTotal = item.totalAmount && item.totalUnit && item.totalUnit === item.progressUnit;
  const pct = hasTotal ? Math.min(100, (item.progress / item.totalAmount!) * 100) : null;

  return (
    <Link href={`/media/${item.mediaItemId}`} className="group flex gap-3 rounded-lg border p-2.5 transition-colors hover:bg-muted/50">
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{MEDIA_TYPE_META[item.type].label}</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="line-clamp-2 text-sm font-medium leading-tight group-hover:underline">{item.title}</div>
        {item.titleNative && (
          <div className="truncate text-xs text-muted-foreground" lang="ja">
            {item.titleNative}
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px]">
            {MEDIA_TYPE_META[item.type].label}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {STATUS_LABELS[item.status]}
          </Badge>
        </div>
        <div className="mt-auto pt-2 text-xs text-muted-foreground">
          {item.progressUnit ? (
            <>
              {formatCompact(item.progress)}
              {hasTotal && ` / ${formatCompact(item.totalAmount!)}`} {UNIT_LABELS[item.progressUnit]}
            </>
          ) : (
            "—"
          )}
          {pct != null && (
            <div className="mt-1 h-1 w-full rounded-[2px] bg-[var(--viz-seq-0)]">
              <div className="h-1 rounded-[2px] bg-[var(--viz-series)]" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
