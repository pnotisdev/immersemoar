import "server-only";
import { cacheGet, cacheSet } from "@/lib/cache-store";
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

function cacheKey(key: ShelfKey) {
  return `shelf:${key}`;
}

/**
 * Two-tier cache. L1 is this in-memory Map: per-process, so repeated requests on the
 * same worker within the TTL window never leave the process. L2 is the `cache_entries`
 * Postgres table (src/lib/cache-store.ts): shared across every PM2 worker, so a plain
 * per-process Map (the previous implementation) doesn't multiply upstream calls by
 * worker count. AniList allows 30 requests a minute and VNDB asks for the same
 * restraint, so the goal is at most one upstream call per shelf per hour, total, not
 * per-process.
 */
type Entry = { at: number; value: Promise<SearchResult[]> };
const memo = new Map<ShelfKey, Entry>();

function loadFresh(key: ShelfKey): Promise<SearchResult[]> {
  return LOADERS[key]().then(
    (items) => {
      // Best-effort: a failed write to the shared cache just means the next request (on
      // this or another process) refetches from upstream instead of hitting Postgres.
      cacheSet(cacheKey(key), items).catch((err) => {
        console.error(`[browse] failed to persist ${key} shelf cache:`, err);
      });
      return items;
    },
    (err) => {
      // A failed fetch must not be cached, or the shelf stays broken for an hour.
      memo.delete(key);
      console.error(`[browse] ${key} failed:`, err);
      return [] as SearchResult[];
    },
  );
}

function load(key: ShelfKey): Promise<SearchResult[]> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = cacheGet<SearchResult[]>(cacheKey(key), TTL_MS)
    .catch((err) => {
      console.error(`[browse] failed to read ${key} shelf cache:`, err);
      return undefined;
    })
    .then((shared) => shared ?? loadFresh(key));

  memo.set(key, { at: Date.now(), value });
  return value;
}

export async function getShelf(key: ShelfKey): Promise<Shelf> {
  return { key, ...SHELF_META[key], items: await load(key) };
}

export async function getShelves(keys: readonly ShelfKey[] = SHELF_KEYS): Promise<Shelf[]> {
  return Promise.all(keys.map(getShelf));
}
