import type { MediaType } from "@/db/schema";
import { cleanDescription, FETCH_TIMEOUT_MS, type SearchResponse, type SearchResult } from "./types";

const ENDPOINT = "https://graphql.anilist.co";

const QUERY = /* GraphQL */ `
  query Search($search: String, $type: MediaType, $formatIn: [MediaFormat], $formatNotIn: [MediaFormat]) {
    Page(perPage: 12) {
      media(
        search: $search
        type: $type
        format_in: $formatIn
        format_not_in: $formatNotIn
        isAdult: false
        sort: SEARCH_MATCH
      ) {
        id
        title { romaji english native }
        coverImage { large }
        episodes
        chapters
        volumes
        format
        startDate { year }
        siteUrl
        description(asHtml: false)
      }
    }
  }
`;

interface AniListMedia {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string | null } | null;
  episodes: number | null;
  chapters: number | null;
  volumes: number | null;
  format: string | null;
  startDate: { year: number | null } | null;
  siteUrl: string | null;
  description: string | null;
}

type AniListType = "anime" | "manga" | "light_novel";

const VARIABLES: Record<AniListType, Record<string, unknown>> = {
  anime: { type: "ANIME" },
  manga: { type: "MANGA", formatNotIn: ["NOVEL"] },
  light_novel: { type: "MANGA", formatIn: ["NOVEL"] },
};

export async function searchAniList(mediaType: AniListType, q: string): Promise<SearchResponse> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { search: q, ...VARIABLES[mediaType] } }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const json = (await res.json()) as { data?: { Page?: { media?: AniListMedia[] } }; errors?: unknown };
  const media = json.data?.Page?.media ?? [];

  const results: SearchResult[] = media.map((m) => {
    const title = m.title.english ?? m.title.romaji ?? m.title.native ?? `AniList #${m.id}`;
    let totalAmount: number | null = null;
    let totalUnit: SearchResult["totalUnit"] = null;
    if (mediaType === "anime" && m.episodes) {
      totalAmount = m.episodes;
      totalUnit = "episodes";
    } else if (mediaType === "manga" && m.chapters) {
      totalAmount = m.chapters;
      totalUnit = "chapters";
    } else if (mediaType === "light_novel" && m.volumes) {
      totalAmount = m.volumes;
      totalUnit = "volumes";
    }
    return {
      source: "anilist",
      sourceId: String(m.id),
      mediaType: mediaType as MediaType,
      title,
      titleNative: m.title.native,
      coverUrl: m.coverImage?.large ?? null,
      year: m.startDate?.year ?? null,
      description: cleanDescription(m.description),
      externalUrl: m.siteUrl,
      totalAmount,
      totalUnit,
      metadata: { format: m.format, romaji: m.title.romaji },
    };
  });
  return { results };
}
