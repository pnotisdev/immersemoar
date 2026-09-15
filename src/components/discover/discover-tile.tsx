"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { addFromSearch } from "@/actions/library";
import { MEDIA_TYPE_META } from "@/lib/media";
import type { SearchResult } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { Poster } from "@/components/media/poster";

/**
 * A title from an external source. Tapping it puts it in your library (as "planning")
 * and takes you to its page — one gesture from "that looks good" to "it's tracked".
 */
export function DiscoverTile({ item, className }: { item: SearchResult; className?: string }) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();

  function add(navigate: boolean) {
    if (pending) return;
    startTransition(async () => {
      const res = await addFromSearch(item);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setAdded(true);
      if (navigate) router.push(`/media/${res.data.mediaItemId}`);
      else toast.success(`${item.title} added to your library`);
    });
  }

  return (
    <div className={cn("group w-32 shrink-0 sm:w-36", className)}>
      <button
        type="button"
        onClick={() => add(true)}
        disabled={pending}
        className="block w-full text-left focus-visible:outline-none"
        aria-label={`Add ${item.title} to your library`}
      >
        <div className="relative">
          <Poster src={item.coverUrl} title={item.title} type={item.mediaType} sizes="144px" />
          <span
            className={cn(
              "absolute right-1.5 bottom-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
              (added || pending) && "opacity-100",
            )}
            aria-hidden
          >
            {added ? <Check className="size-4 text-emerald-500" /> : <Plus className="size-4" />}
          </span>
        </div>
        <p className="mt-1.5 line-clamp-2 min-h-8 text-xs leading-snug font-medium group-hover:text-primary">
          {item.title}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {MEDIA_TYPE_META[item.mediaType].label}
          {item.year ? ` · ${item.year}` : ""}
        </p>
      </button>
    </div>
  );
}
