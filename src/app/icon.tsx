import { ImageResponse } from "next/og";

// A placeholder mark, not designed artwork — see AGENTS.md's SEO priority note. Matches
// the wordmark's own lowercase "immerse" styling and the app's blue accent
// (--viz-series / --primary in src/app/globals.css) so it doesn't look arbitrary.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // No border-radius: favicon/PWA consumers (browser tabs, Android adaptive
          // icons, etc.) apply their own corner treatment — a pre-rounded source image
          // just leaves mismatched padding once they mask it their own way.
          background: "#2a78d6",
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ color: "white", fontSize: 280, fontWeight: 700, letterSpacing: -8 }}>im</span>
      </div>
    ),
    { ...size },
  );
}
