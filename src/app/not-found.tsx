import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <Compass className="size-10 text-muted-foreground" aria-hidden />
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Page not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          That page doesn&apos;t exist, or it moved somewhere else.
        </p>
      </div>
      <Button render={<Link href="/" />} nativeButton={false} className="mt-2">
        Back home
      </Button>
    </div>
  );
}
