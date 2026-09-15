import Link from "next/link";
import type { MediaType } from "@/db/schema";
import { cn } from "@/lib/utils";
import { Poster } from "./poster";
import { ScrollRail } from "./scroll-rail";

export interface RailItem {
  mediaItemId: string;
  title: string;
  coverUrl: string | null;
  type: MediaType;
  meta?: string;
}

/** Horizontally scrollable poster rail for items that already live in the database. */
export function MediaRail({ items, label, className }: { items: RailItem[]; label: string; className?: string }) {
  return (
    <ScrollRail label={label} className={className}>
      {items.map((item) => (
        <Link key={item.mediaItemId} href={`/media/${item.mediaItemId}`} className="group w-28 shrink-0 sm:w-32">
          <Poster src={item.coverUrl} title={item.title} type={item.type} sizes="128px" />
          <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-snug font-medium group-hover:text-primary">
            {item.title}
          </p>
          {item.meta && <p className="text-[11px] text-muted-foreground">{item.meta}</p>}
        </Link>
      ))}
    </ScrollRail>
  );
}

/** Same tiles, laid out as a wrapping grid — for pages where everything should be visible. */
export function MediaGrid({ items, className }: { items: RailItem[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-6", className)}>
      {items.map((item) => (
        <Link key={item.mediaItemId} href={`/media/${item.mediaItemId}`} className="group">
          <Poster src={item.coverUrl} title={item.title} type={item.type} sizes="(max-width: 640px) 33vw, 160px" />
          <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-snug font-medium group-hover:text-primary">
            {item.title}
          </p>
          {item.meta && <p className="text-[11px] text-muted-foreground">{item.meta}</p>}
        </Link>
      ))}
    </div>
  );
}
