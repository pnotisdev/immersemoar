import "server-only";
import { browseAniList } from "./anilist";
import type { SearchResult } from "./types";
import { browseVndb } from "./vndb";

export interface Shelf {
  key: ShelfKey;
  title: string;
  /** Where the art comes from, credited in the UI. */
  credit: string;
  blurb: string;
  items: SearchResult[];
}

export const SHELF_KEYS = ["anime", "manga", "light_novel", "visual_novel"] as const;
export type ShelfKey = (typeof SHELF_KEYS)[number];

export function isShelfKey(value: string): value is ShelfKey {
  return (SHELF_KEYS as readonly string[]).includes(value);
}

/** One request per shelf fills both the rail and its "view all" page. */
const PER_SHELF = 40;

export const SHELF_META: Record<ShelfKey, { title: string; credit: string; blurb: string }> = {
  anime: { title: "Trending anime", credit: "AniList", blurb: "What people are watching right now, from AniList." },
  manga: { title: "Popular manga", credit: "AniList", blurb: "The most-followed manga on AniList." },
  light_novel: { title: "Light novels", credit: "AniList", blurb: "The most-followed light novels on AniList." },
  visual_novel: { title: "Visual novels", credit: "VNDB", blurb: "The most-voted Japanese visual novels on VNDB." },
};

const LOADERS: Record<ShelfKey, () => Promise<SearchResult[]>> = {
  anime: () => browseAniList("anime", "TRENDING_DESC", PER_SHELF),
  manga: () => browseAniList("manga", "POPULARITY_DESC", PER_SHELF),
  light_novel: () => browseAniList("light_novel", "POPULARITY_DESC", PER_SHELF),
  visual_novel: () => browseVndb(PER_SHELF),
};

const TTL_MS = 60 * 60 * 1000;
type Entry = { at: number; value: Promise<SearchResult[]> };
// Module-level so one process makes at most one upstream call per shelf per hour:
// AniList allows 30 requests a minute and VNDB asks for the same restraint.
const cache = new Map<ShelfKey, Entry>();

function load(key: ShelfKey): Promise<SearchResult[]> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = LOADERS[key]().catch((err) => {
    // A failed fetch must not be cached, or the shelf stays broken for an hour.
    cache.delete(key);
    console.error(`[browse] ${key} failed:`, err);
    return [] as SearchResult[];
  });
  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function getShelf(key: ShelfKey): Promise<Shelf> {
  return { key, ...SHELF_META[key], items: await load(key) };
}

export async function getShelves(keys: readonly ShelfKey[] = SHELF_KEYS): Promise<Shelf[]> {
  return Promise.all(keys.map(getShelf));
}
