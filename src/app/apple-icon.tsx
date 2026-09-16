import { ImageResponse } from "next/og";

// Apple's own recommended apple-touch-icon size. Square with no border-radius or
// transparency — iOS applies its own corner mask and a background is required (a
// transparent source renders as black on the home screen).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2a78d6",
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ color: "white", fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>im</span>
      </div>
    ),
    { ...size },
  );
}
