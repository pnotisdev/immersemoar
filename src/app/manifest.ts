import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "immersemoar",
    short_name: "immersemoar",
    description: "Track every hour of Japanese you consume: anime, manga, visual novels, books, podcasts and more.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    // Matches the app's blue accent (--viz-series / --primary in src/app/globals.css).
    theme_color: "#2a78d6",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
