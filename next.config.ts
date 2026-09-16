import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WASM and postgres.js opens sockets — keep both out of the server bundle.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  images: {
    // Restricted to the CDNs this app actually pulls media from (see src/lib/sources/*)
    // plus DiceBear (generated avatars, see scripts/seed-demo.ts). A wildcard hostname here
    // would let anyone proxy arbitrary third-party images through /_next/image.
    remotePatterns: [
      { protocol: "https", hostname: "s4.anilist.co" },
      { protocol: "https", hostname: "t.vndb.org" },
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
    ],
  },
};

export default nextConfig;
