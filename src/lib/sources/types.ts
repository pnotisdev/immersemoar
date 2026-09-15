import type { MediaSource, MediaType, Unit } from "@/db/schema";

/** One normalized hit from any external source, ready to become a media_items row. */
export interface SearchResult {
  source: Exclude<MediaSource, "manual">;
  sourceId: string;
  mediaType: MediaType;
  title: string;
  titleNative: string | null;
  coverUrl: string | null;
  year: number | null;
  description: string | null;
  externalUrl: string | null;
  totalAmount: number | null;
  totalUnit: Unit | null;
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  /** Non-fatal problem, e.g. a missing API key. */
  warning?: string;
}

export const FETCH_TIMEOUT_MS = 8000;

/** Strip HTML tags / BBCode and collapse whitespace; truncate for storage. */
export function cleanDescription(raw: string | null | undefined, max = 600): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\/?(?:url|spoiler|b|i|u|s|quote|code|raw)[^\]]*\]/gi, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export function yearFrom(dateish: string | number | null | undefined): number | null {
  if (dateish == null) return null;
  if (typeof dateish === "number") return Number.isFinite(dateish) ? dateish : null;
  const m = /^(\d{4})/.exec(dateish);
  return m ? Number(m[1]) : null;
}
