import { ImageResponse } from "next/og";

export const alt = "immersemoar — track every hour of Japanese you consume";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static branding card — no per-request data, so this is generated once and cached
// (see the "Good to know" on statically-optimized images in
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/opengraph-image.md).
export default function Image() {
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
        <div style={{ display: "flex", fontSize: 88, fontWeight: 700, color: "white", letterSpacing: -2 }}>
          immerse<span style={{ color: "#8a93a6" }}>moar</span>
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#c3c9d6", textAlign: "center", maxWidth: 880 }}>
          Track every hour of Japanese you consume
        </div>
      </div>
    ),
    { ...size },
  );
}
