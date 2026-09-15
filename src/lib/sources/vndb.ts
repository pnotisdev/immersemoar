import { cleanDescription, FETCH_TIMEOUT_MS, type SearchResponse, type SearchResult, yearFrom } from "./types";

const ENDPOINT = "https://api.vndb.org/kana/vn";

interface VndbVn {
  id: string; // "v17"
  title: string;
  alttitle: string | null;
  image: { url: string; sexual: number; violence: number } | null;
  released: string | null; // "2004-08-26" | "tba"
  length_minutes: number | null;
  description: string | null;
}

export async function searchVndb(q: string): Promise<SearchResponse> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: ["search", "=", q],
      fields: "id,title,alttitle,image.url,image.sexual,image.violence,released,length_minutes,description",
      results: 12,
      sort: "searchrank",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`VNDB responded ${res.status}`);
  const json = (await res.json()) as { results: VndbVn[] };

  const results: SearchResult[] = json.results.map((vn) => {
    // VNDB flags covers 0-2 for sexual/violent content; only surface clearly safe ones.
    const safeCover = vn.image && vn.image.sexual < 1 && vn.image.violence < 1 ? vn.image.url : null;
    return {
      source: "vndb",
      sourceId: vn.id,
      mediaType: "visual_novel",
      title: vn.title,
      titleNative: vn.alttitle,
      coverUrl: safeCover,
      year: yearFrom(vn.released),
      description: cleanDescription(vn.description),
      externalUrl: `https://vndb.org/${vn.id}`,
      totalAmount: null,
      totalUnit: null,
      metadata: { lengthMinutes: vn.length_minutes },
    };
  });
  return { results };
}
