"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
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
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="size-10 text-destructive" aria-hidden />
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {error.digest ? `Error reference: ${error.digest}` : "An unexpected error occurred."}
        </p>
      </div>
      <Button onClick={() => retry()} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
