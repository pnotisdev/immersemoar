"use client";

// global-error replaces the root layout entirely when it triggers, so it must
// bring its own <html>/<body> and re-import the styles/fonts the root layout
// normally provides — see node_modules/next/dist/docs/.../error.md.
import { useEffect } from "react";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={`${geistSans.variable} antialiased`}>
      <body className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center text-foreground">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {error.digest ? `Error reference: ${error.digest}` : "An unexpected error occurred."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-2 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
