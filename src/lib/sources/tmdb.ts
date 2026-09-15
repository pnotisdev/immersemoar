import { cleanDescription, FETCH_TIMEOUT_MS, type SearchResponse, type SearchResult, yearFrom } from "./types";

const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w342";

interface TmdbMovie {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  poster_path: string | null;
  release_date: string | null;
  overview: string | null;
}
interface TmdbTv {
  id: number;
  name: string;
  original_name: string;
  original_language: string;
  poster_path: string | null;
  first_air_date: string | null;
  overview: string | null;
}

export async function searchTmdb(kind: "movie" | "series", q: string): Promise<SearchResponse> {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    return { results: [], warning: "TMDB search is not configured (set TMDB_API_KEY). You can still add movies/series manually." };
  }
  const path = kind === "movie" ? "search/movie" : "search/tv";
  const url = new URL(`${API}/${path}`);
  url.searchParams.set("query", q);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`TMDB responded ${res.status}`);
  const json = (await res.json()) as { results: (TmdbMovie | TmdbTv)[] };

  const results: SearchResult[] = json.results.slice(0, 12).map((r) => {
    const isMovie = kind === "movie";
    const m = r as TmdbMovie;
    const t = r as TmdbTv;
    const title = isMovie ? m.title : t.name;
    const original = isMovie ? m.original_title : t.original_name;
    const date = isMovie ? m.release_date : t.first_air_date;
    return {
      source: "tmdb",
      sourceId: `${isMovie ? "movie" : "tv"}:${r.id}`,
      mediaType: kind,
      title,
      // Only treat the original title as "native" when it's actually Japanese.
      titleNative: r.original_language === "ja" && original !== title ? original : null,
      coverUrl: r.poster_path ? `${IMG}${r.poster_path}` : null,
      year: yearFrom(date),
      description: cleanDescription(r.overview),
      externalUrl: `https://www.themoviedb.org/${isMovie ? "movie" : "tv"}/${r.id}`,
      totalAmount: null,
      totalUnit: null,
      metadata: { originalLanguage: r.original_language },
    };
  });
  return { results };
}
