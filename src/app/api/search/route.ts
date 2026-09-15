import { NextResponse, type NextRequest } from "next/server";
import { MEDIA_TYPES, type MediaType } from "@/db/schema";
import { getSession } from "@/lib/session";
import { searchExternal } from "@/lib/sources";

// GET /api/search?type=anime&q=frieren
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const type = request.nextUrl.searchParams.get("type") ?? "";
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!(MEDIA_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "Invalid media type" }, { status: 400 });
  }

  try {
    const data = await searchExternal(type as MediaType, q);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ results: [], warning: message }, { status: 502 });
  }
}
