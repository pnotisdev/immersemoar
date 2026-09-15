"use client";

import { useState } from "react";
import type { MediaType } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { formatDuration } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LibraryPick } from "@/components/library/types";
import { SessionForm } from "./session-form";

export interface QuickLogItem {
  mediaItemId: string;
  title: string;
  titleNative: string | null;
  coverUrl: string | null;
  type: MediaType;
  /** Pre-formatted on the server ("3h ago") so SSR and hydration agree. */
  lastLabel: string;
  seconds: number;
}

/** Cover tiles for recently logged items; one click opens a pre-filled session form. */
export function QuickLogGrid({ items, entries, tz }: { items: QuickLogItem[]; entries: LibraryPick[]; tz: string }) {
  const [active, setActive] = useState<QuickLogItem | null>(null);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Items you log show up here for one-click logging.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.mediaItemId}
            type="button"
            onClick={() => setActive(it)}
            className="group relative aspect-[2/3] overflow-hidden rounded-lg bg-muted text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            title={`Log ${it.title}`}
          >
            {it.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={it.coverUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" loading="lazy" />
            ) : (
              <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">{MEDIA_TYPE_META[it.type].label}</div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-2 pt-6 text-white">
              <div className="text-[9px] font-medium tracking-widest text-white/70 uppercase">Quick log</div>
              <div className="line-clamp-2 text-xs font-medium leading-tight">{it.title}</div>
              <div className="text-[10px] text-white/70">
                {formatDuration(it.seconds)} · {it.lastLabel}
              </div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log a session</DialogTitle>
            <DialogDescription>{active?.title}</DialogDescription>
          </DialogHeader>
          {active && (
            <SessionForm
              key={active.mediaItemId}
              entries={entries}
              tz={tz}
              initial={{ mediaItemId: active.mediaItemId, mediaType: active.type }}
              onDone={() => setActive(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
