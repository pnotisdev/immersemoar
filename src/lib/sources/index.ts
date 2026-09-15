import type { MediaType } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { searchAniList } from "./anilist";
import { searchGoogleBooks } from "./google-books";
import { searchTmdb } from "./tmdb";
import type { SearchResponse } from "./types";
import { searchVndb } from "./vndb";

export type { SearchResult, SearchResponse } from "./types";

/** Route a search to the right external source for the media type. */
export async function searchExternal(mediaType: MediaType, q: string): Promise<SearchResponse> {
  const query = q.trim();
  if (query.length < 2) return { results: [] };

  switch (MEDIA_TYPE_META[mediaType].searchSource) {
    case "anilist":
      return searchAniList(mediaType as "anime" | "manga" | "light_novel", query);
    case "vndb":
      return searchVndb(query);
    case "tmdb":
      return searchTmdb(mediaType as "movie" | "series", query);
    case "google_books":
      return searchGoogleBooks(mediaType as "book" | "graded_reader", query);
    case null:
      return { results: [], warning: `${MEDIA_TYPE_META[mediaType].label} has no search source; add it manually.` };
  }
}
