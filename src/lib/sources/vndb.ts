import { cleanDescription, FETCH_TIMEOUT_MS, type SearchResponse, type SearchResult, yearFrom } from "./types";

const ENDPOINT = "https://api.vndb.org/kana/vn";
const FIELDS = "id,title,alttitle,image.url,image.sexual,image.violence,released,length_minutes,description";

interface VndbVn {
  id: string; // "v17"
  title: string;
  alttitle: string | null;
  image: { url: string; sexual: number; violence: number } | null;
  released: string | null; // "2004-08-26" | "tba"
  length_minutes: number | null;
  description: string | null;
}

async function post(body: Record<string, unknown>): Promise<VndbVn[]> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: FIELDS, ...body }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`VNDB responded ${res.status}`);
  const json = (await res.json()) as { results: VndbVn[] };
  return json.results;
}

function toResult(vn: VndbVn): SearchResult {
  // VNDB flags covers 0-2 for sexual/violent content; only surface clearly safe ones.
  const safeCover = vn.image && vn.image.sexual < 1 && vn.image.violence < 1 ? vn.image.url : null;
  return {
    source: "vndb",
    sourceId: vn.id,
    mediaType: "visual_novel",
    title: vn.title,
    titleNative: vn.alttitle,
    coverUrl: safeCover,
    bannerUrl: null,
    year: yearFrom(vn.released),
    description: cleanDescription(vn.description),
    externalUrl: `https://vndb.org/${vn.id}`,
    totalAmount: null,
    totalUnit: null,
    metadata: { lengthMinutes: vn.length_minutes },
  };
}

export async function searchVndb(q: string): Promise<SearchResponse> {
  const results = await post({ filters: ["search", "=", q], results: 12, sort: "searchrank" });
  return { results: results.map(toResult) };
}

/** Most-voted Japanese-original VNs — the Discover shelf. Callers cache. */
export async function browseVndb(limit = 24): Promise<SearchResult[]> {
  const results = await post({
    filters: ["olang", "=", "ja"],
    results: limit,
    sort: "votecount",
    reverse: true,
  });
  // Covers flagged as explicit come back null; those tiles would just be empty boxes.
  return results.map(toResult).filter((r) => r.coverUrl);
}
