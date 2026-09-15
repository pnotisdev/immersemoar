import Link from "next/link";
import type { MediaType } from "@/db/schema";
import { formatDuration } from "@/lib/format";
import { MEDIA_TYPE_META } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Poster } from "@/components/media/poster";

export interface TopTitle {
  mediaItemId: string;
  title: string;
  titleNative?: string | null;
  coverUrl: string | null;
  type: MediaType;
  seconds: number;
  /** Optional trailing detail: "12 sessions", "Ep 8/24"… */
  detail?: string;
}

/**
 * The answer to "what did they actually watch and read": a ranked chart where the bar
 * is the time and the artwork is the point. Deliberately not a card grid.
 */
export function TopTitles({
  items,
  emptyText = "Nothing logged yet.",
  max: explicitMax,
}: {
  items: TopTitle[];
  emptyText?: string;
  max?: number;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = explicitMax ?? Math.max(...items.map((i) => i.seconds), 1);

  return (
    <ol className="divide-y divide-border/60">
      {items.map((item, i) => (
        <li key={item.mediaItemId}>
          <Link href={`/media/${item.mediaItemId}`} className="group flex items-center gap-3 py-2.5 sm:gap-4">
            <span
              className={cn(
                "w-5 shrink-0 text-right text-sm font-semibold tabular-nums",
                i === 0 ? "text-primary" : "text-muted-foreground/70",
              )}
            >
              {i + 1}
            </span>

            <div className="w-9 shrink-0 sm:w-11">
              <Poster src={item.coverUrl} title={item.title} type={item.type} sizes="48px" className="rounded-[4px]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium group-hover:text-primary">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {MEDIA_TYPE_META[item.type].label}
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
              {/* The bar lives under the title so long names never squeeze it. */}
              <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-[var(--viz-seq-0)]">
                <div
                  className="h-full rounded-full bg-[var(--viz-series)] transition-[width] duration-500"
                  style={{ width: `${Math.max(2, (item.seconds / max) * 100)}%` }}
                />
              </div>
            </div>

            <span className="shrink-0 text-sm font-semibold tabular-nums">{formatDuration(item.seconds)}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
