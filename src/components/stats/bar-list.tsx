import Link from "next/link";
import { formatDuration } from "@/lib/format";

export type BarTone = "default" | "reading" | "listening";

const BAR_CLASSES: Record<BarTone, string> = {
  default: "bg-[var(--viz-series)]",
  reading: "bg-amber-500",
  listening: "bg-teal-500",
};

export interface BarRow {
  label: string;
  sublabel?: string;
  seconds: number;
  href?: string;
  tone?: BarTone;
}

/** Horizontal bars with values at the tip. Good for "hours by type" / "top items". */
export function BarList({ rows, emptyText = "Nothing yet" }: { rows: BarRow[]; emptyText?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const max = Math.max(...rows.map((r) => r.seconds), 1);
  return (
    <ul className="grid gap-2.5">
      {rows.map((r, i) => {
        const pct = (r.seconds / max) * 100;
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate">
                {r.label}
                {r.sublabel && <span className="ml-1.5 text-xs text-muted-foreground">{r.sublabel}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{formatDuration(r.seconds)}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-[4px] bg-[var(--viz-seq-0)]">
              <div className={`h-2 rounded-[4px] ${BAR_CLASSES[r.tone ?? "default"]}`} style={{ width: `${pct}%` }} />
            </div>
          </>
        );
        return (
          <li key={i}>
            {r.href ? (
              <Link href={r.href} className="block rounded-md transition-colors hover:bg-muted/50">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
