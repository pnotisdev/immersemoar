"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { RangePreset } from "@/lib/dates";
import { cn } from "@/lib/utils";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "all", label: "All time" },
];

/** Preset pills + a custom from/to form, all driven by URL search params so pages stay server-rendered. */
export function RangePicker({
  current,
  from,
  to,
}: {
  current: RangePreset | "custom";
  from?: string;
  to?: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  // The two date fields are noise until someone actually wants a custom range.
  const [showCustom, setShowCustom] = useState(current === "custom");

  function href(preset: RangePreset) {
    const p = new URLSearchParams(params.toString());
    p.set("range", preset);
    p.delete("from");
    p.delete("to");
    return `${pathname}?${p.toString()}`;
  }

  return (
    <div className="grid gap-2.5">
      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={href(p.key)}
            aria-current={current === p.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
              current === p.key
                ? "border-transparent bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          aria-expanded={showCustom}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
            current === "custom"
              ? "border-transparent bg-foreground text-background"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
        >
          Custom
        </button>
      </div>

      {/* Wraps on phones: two date fields and a button don't fit one 375px row. */}
      {showCustom && (
        <form method="get" action={pathname} className="flex flex-wrap items-center gap-1.5 text-sm">
          {[...params.entries()]
            .filter(([k]) => !["range", "from", "to"].includes(k))
            .map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
          <input type="hidden" name="range" value="custom" />
          <input
            type="date"
            name="from"
            defaultValue={from}
            required
            aria-label="From"
            className="h-8 min-w-0 flex-1 rounded-full border bg-transparent px-3 outline-none focus-visible:border-ring sm:flex-none"
          />
          <span className="text-muted-foreground">–</span>
          <input
            type="date"
            name="to"
            defaultValue={to}
            required
            aria-label="To"
            className="h-8 min-w-0 flex-1 rounded-full border bg-transparent px-3 outline-none focus-visible:border-ring sm:flex-none"
          />
          <button
            type="submit"
            className={cn(
              "h-8 shrink-0 rounded-full border px-3.5 text-xs transition-colors hover:bg-muted",
              current === "custom" &&
                "border-transparent bg-foreground text-background",
            )}
          >
            Go
          </button>
        </form>
      )}
    </div>
  );
}
