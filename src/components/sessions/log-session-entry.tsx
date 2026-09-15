import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The single "log something" entry point that lives in the chrome: a pill in the
 * desktop header, and the raised middle button of the mobile tab bar.
 */
export function LogSessionEntry({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <Link
        href="/log/new"
        aria-label="Log immersion"
        className={cn(
          "-mt-5 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95",
          className,
        )}
      >
        <Plus className="size-6" strokeWidth={2.2} />
      </Link>
    );
  }
  return (
    <Link
      href="/log/new"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
        className,
      )}
    >
      <Plus className="size-4" />
      Log
    </Link>
  );
}
