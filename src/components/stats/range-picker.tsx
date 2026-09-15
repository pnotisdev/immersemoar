"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

/** Preset rows + a custom from/to form, all driven by URL search params so pages stay server-rendered. */
export function RangePicker({ current, from, to }: { current: RangePreset | "custom"; from?: string; to?: string }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function href(preset: RangePreset) {
    const p = new URLSearchParams(params.toString());
    p.set("range", preset);
    p.delete("from");
    p.delete("to");
    return `${pathname}?${p.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border p-1">
        {PRESETS.map((p) => (
          <Link
            key={p.key}
            href={href(p.key)}
            className={cn(
              "rounded-md px-2.5 py-1 text-sm",
              current === p.key ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action={pathname} className="flex items-center gap-1.5 text-sm">
        {[...params.entries()].filter(([k]) => !["range", "from", "to"].includes(k)).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="hidden" name="range" value="custom" />
        <input type="date" name="from" defaultValue={from} required className="h-8 rounded-md border bg-transparent px-2" aria-label="From" />
        <span className="text-muted-foreground">–</span>
        <input type="date" name="to" defaultValue={to} required className="h-8 rounded-md border bg-transparent px-2" aria-label="To" />
        <button type="submit" className={cn("rounded-md border px-2.5 py-1", current === "custom" && "bg-muted font-medium")}>
          Go
        </button>
      </form>
    </div>
  );
}
