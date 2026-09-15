import Image from "next/image";
import type { MediaType } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * Cover art in the standard 2:3 poster frame. Sources (AniList, VNDB, TMDB, Google Books)
 * all hand back different ratios, so everything is cropped to the same shape and titles
 * without art fall back to a typographic tile instead of an empty box.
 */
export function Poster({
  src,
  title,
  type,
  className,
  sizes = "(max-width: 640px) 33vw, 180px",
  priority = false,
}: {
  src: string | null;
  title: string;
  type?: MediaType;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("poster", className)}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1 bg-gradient-to-br from-muted to-secondary p-2 text-center">
          <span className="line-clamp-3 text-[11px] leading-tight font-medium text-muted-foreground" lang="ja">
            {title}
          </span>
          {type && <span className="text-[9px] tracking-wide text-muted-foreground/70 uppercase">{MEDIA_TYPE_META[type].label}</span>}
        </div>
      )}
    </div>
  );
}

/** Thumbnail strip used in dense lists (sessions, feed rows). */
export function Thumb({
  src,
  title,
  className,
  size = "md",
}: {
  src: string | null;
  title: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-9 w-6" : "h-12 w-8";
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-[5px] bg-muted", dim, className)}>
      {src ? (
        <Image src={src} alt="" fill sizes="48px" className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-[9px] font-medium text-muted-foreground">
          {title.slice(0, 1)}
        </span>
      )}
    </div>
  );
}
