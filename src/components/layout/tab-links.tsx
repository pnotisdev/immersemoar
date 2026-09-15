import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabLink {
  href: string;
  label: string;
  count?: number;
}

/**
 * Link-based tabs, so pages that use them stay plain server renders.
 * Two looks: `underline` for page-level sections, `pill` for filters.
 */
export function TabLinks({
  tabs,
  active,
  variant = "underline",
  className,
}: {
  tabs: TabLink[];
  /** href of the current tab. */
  active: string;
  variant?: "underline" | "pill";
  className?: string;
}) {
  if (variant === "pill") {
    return (
      <div className={cn("no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.href === active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
              t.href === active
                ? "border-transparent bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {t.label}
            {t.count != null && <span className="ml-1.5 tabular-nums opacity-60">{t.count}</span>}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("no-scrollbar -mx-4 mb-5 flex gap-1 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0", className)}>
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors",
            t.href === active
              ? "border-primary font-medium text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
          {t.count != null && <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}
