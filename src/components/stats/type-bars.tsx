import type { MediaType } from "@/db/schema";
import { formatDuration } from "@/lib/format";
import { MEDIA_TYPE_META } from "@/lib/media";

export interface TypeRow {
  mediaType: MediaType;
  seconds: number;
  count?: number;
}

/** Per-medium time, coloured by reading vs listening so the mix reads at a glance. */
export function TypeBars({ rows, limit = 7 }: { rows: TypeRow[]; limit?: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing logged yet.</p>;
  const max = Math.max(...rows.map((r) => r.seconds), 1);

  return (
    <ul className="grid gap-3">
      {rows.slice(0, limit).map((r) => (
        <li key={r.mediaType} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-sm">
          <span className="truncate">{MEDIA_TYPE_META[r.mediaType].label}</span>
          <span className="tabular-nums text-muted-foreground">{formatDuration(r.seconds)}</span>
          <div className="col-span-2 mt-1 h-[3px] overflow-hidden rounded-full bg-[var(--viz-seq-0)]">
            <div
              className={
                MEDIA_TYPE_META[r.mediaType].group === "reading"
                  ? "h-full bg-amber-500"
                  : MEDIA_TYPE_META[r.mediaType].group === "listening"
                    ? "h-full bg-teal-500"
                    : "h-full bg-muted-foreground/60"
              }
              style={{ width: `${Math.max(2, (r.seconds / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
