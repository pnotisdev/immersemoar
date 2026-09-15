import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and postgres.js opens sockets — keep both out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "t.vndb.org" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
