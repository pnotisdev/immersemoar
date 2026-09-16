import { ImageResponse } from "next/og";
import { getPublicUser } from "@/lib/ranking-queries";

export const alt = "immersemoar profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Unlike the page itself (src/app/(app)/u/[username]/page.tsx), this never calls
 * requireUser() — metadata file conventions like opengraph-image are their own Route
 * Handlers, not part of the page's component tree, so they don't inherit
 * src/app/(app)/layout.tsx's auth redirect. That's intentional: link-unfurling bots
 * (Slack, Discord, iMessage, etc.) fetch this unauthenticated, the same way they would
 * for any public site's OG image. getPublicUser already returns null for a private or
 * nonexistent profile, in which case this just renders the generic card instead of
 * leaking whether that username exists.
 */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const user = await getPublicUser(username);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#171b26",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(135deg, #1c2436 0%, #171b26 55%, #12151d 100%)",
          }}
        />
        <div style={{ position: "absolute", top: -120, right: -120, width: 420, height: 420, borderRadius: 420, background: "#2a78d6", opacity: 0.25, display: "flex" }} />
        {user ? (
          // A real flex container, not a bare Fragment: Satori (the renderer behind
          // ImageResponse) needs an actual element to group multiple stacked children —
          // a Fragment here silently collapsed them onto one row instead of a column.
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 700, color: "white", letterSpacing: -1, textAlign: "center", maxWidth: 1000 }}>
              {user.name}
            </div>
            <div style={{ display: "flex", marginTop: 16, fontSize: 32, color: "#7fb1ea" }}>@{user.username}</div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#c3c9d6" }}>Tracking immersion time on immersemoar</div>
          </div>
        ) : (
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: "white", letterSpacing: -1 }}>
            immerse<span style={{ color: "#8a93a6" }}>moar</span>
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
