import type { MediaType } from "@/db/schema";
import { cleanDescription, FETCH_TIMEOUT_MS, type SearchResponse, type SearchResult } from "./types";

const ENDPOINT = "https://graphql.anilist.co";

const MEDIA_FIELDS = /* GraphQL */ `
  id
  title { romaji english native }
  coverImage { large }
  bannerImage
  episodes
  chapters
  volumes
  format
  startDate { year }
  siteUrl
  description(asHtml: false)
`;

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
        ${MEDIA_FIELDS}
      }
    }
  }
`;

const BROWSE_QUERY = /* GraphQL */ `
  query Browse($type: MediaType, $formatIn: [MediaFormat], $formatNotIn: [MediaFormat], $sort: [MediaSort], $perPage: Int) {
    Page(perPage: $perPage) {
      media(
        type: $type
        format_in: $formatIn
        format_not_in: $formatNotIn
        countryOfOrigin: "JP"
        isAdult: false
        sort: $sort
      ) {
        ${MEDIA_FIELDS}
      }
    }
  }
`;

interface AniListMedia {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string | null } | null;
  bannerImage: string | null;
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

async function query(body: unknown): Promise<AniListMedia[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`AniList responded ${res.status}`);
  const json = (await res.json()) as { data?: { Page?: { media?: AniListMedia[] } } };
  return json.data?.Page?.media ?? [];
}

function toResult(m: AniListMedia, mediaType: AniListType): SearchResult {
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
    bannerUrl: m.bannerImage,
    year: m.startDate?.year ?? null,
    description: cleanDescription(m.description),
    externalUrl: m.siteUrl,
    totalAmount,
    totalUnit,
    metadata: { format: m.format, romaji: m.title.romaji },
  };
}

export async function searchAniList(mediaType: AniListType, q: string): Promise<SearchResponse> {
  const media = await query({ query: QUERY, variables: { search: q, ...VARIABLES[mediaType] } });
  return { results: media.map((m) => toResult(m, mediaType)) };
}

export type AniListSort = "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC";

/** Charts for the Discover page. Callers cache: "what's trending" is the same for everyone. */
export async function browseAniList(mediaType: AniListType, sort: AniListSort, perPage = 24): Promise<SearchResult[]> {
  const media = await query({ query: BROWSE_QUERY, variables: { sort: [sort], perPage, ...VARIABLES[mediaType] } });
  return media.map((m) => toResult(m, mediaType));
}
