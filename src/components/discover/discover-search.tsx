"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { MEDIA_TYPE_META } from "@/lib/media";
import type { MediaType } from "@/db/schema";
import type { SearchResponse, SearchResult } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { DiscoverTile } from "./discover-tile";

/** Media types that can actually be searched, in the order people reach for them. */
const TYPES: MediaType[] = ["anime", "manga", "visual_novel", "light_novel", "book", "series", "movie"];

export function DiscoverSearch() {
  const [type, setType] = useState<MediaType>("anime");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = q.trim();
  // Results are only shown for a live query, so the effect never has to clear them.
  const visible = query.length >= 2 ? results : [];
  const visibleWarning = query.length >= 2 ? warning : null;

  useEffect(() => {
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?type=${type}&q=${encodeURIComponent(query)}`, { signal: ctrl.signal });
        const data = (await res.json()) as SearchResponse;
        setResults(data.results ?? []);
        setWarning(data.warning ?? null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setWarning("Search failed. Try again.");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query, type]);

  return (
    <div className="grid gap-3">
      <div className="relative">
        {loading ? (
          <Loader2 className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${MEDIA_TYPE_META[type].label.toLowerCase()}…`}
          aria-label="Search titles"
          className="h-11 w-full rounded-full border bg-card pr-4 pl-10 text-sm outline-none transition-colors focus-visible:border-ring"
        />
      </div>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
              t === type
                ? "border-transparent bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {MEDIA_TYPE_META[t].label}
          </button>
        ))}
      </div>

      {visibleWarning && <p className="text-xs text-muted-foreground">{visibleWarning}</p>}

      {visible.length > 0 && (
        <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-5 lg:grid-cols-7">
          {visible.map((r) => (
            <DiscoverTile key={`${r.source}:${r.sourceId}`} item={r} className="w-full" />
          ))}
        </div>
      )}
      {query.length >= 2 && !loading && visible.length === 0 && !visibleWarning && (
        <p className="text-sm text-muted-foreground">No results for “{query}”.</p>
      )}
    </div>
  );
}
