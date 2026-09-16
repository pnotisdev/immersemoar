import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { getSiteUrl } from "@/lib/site";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  // Without this, Next resolves relative OG/Twitter image URLs (every opengraph-image.tsx
  // in this app returns one implicitly) against "http://localhost:3000" at build time —
  // fine in dev, silently wrong in production. See src/lib/site.ts.
  metadataBase: new URL(getSiteUrl()),
  title: { default: "immersemoar", template: "%s · immersemoar" },
  description: "Track everything you consume in Japanese: anime, manga, VNs, books, movies, podcasts, and your hours.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
