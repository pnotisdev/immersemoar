import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StripStat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}

/**
 * Numbers as typography, not as boxes: a hairline, small caps labels and big tabular
 * figures. Cards around single numbers are what makes a dashboard look generic.
 */
export function StatStrip({ stats, className }: { stats: StripStat[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-5 border-t pt-5 sm:grid-cols-4", className)}>
      {stats.map((s) => (
        <div key={s.label} className="min-w-0">
          <dt className="section-label truncate">{s.label}</dt>
          <dd
            className={cn(
              "mt-1 text-2xl leading-none font-semibold tracking-tight tabular-nums sm:text-3xl",
              s.accent && "text-primary",
            )}
          >
            {s.value}
          </dd>
          {s.hint && <dd className="mt-1.5 truncate text-xs text-muted-foreground">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

export interface Segment {
  label: string;
  seconds: number;
  /** Tailwind background class for the segment and its legend dot. */
  color: string;
}

/** One bar, two or three parts — the shape of someone's input at a glance. */
export function SplitBar({ segments, className }: { segments: Segment[]; className?: string }) {
  const total = segments.reduce((a, s) => a + s.seconds, 0);
  if (total === 0) return null;

  return (
    <div className={className}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", s.color)}
            style={{ width: `${(s.seconds / total) * 100}%` }}
            title={`${s.label}: ${Math.round((s.seconds / total) * 100)}%`}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-baseline gap-1.5 text-sm">
            <span className={cn("size-2 shrink-0 translate-y-[-1px] rounded-full", s.color)} aria-hidden />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-medium tabular-nums">{Math.round((s.seconds / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
