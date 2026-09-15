import { ArrowDownRight, ArrowUpRight, BookOpen, Headphones, Sparkles, type LucideIcon } from "lucide-react";
import { toHours } from "@/lib/format";
import { percentChange } from "@/lib/progression";
import type { GroupTotals } from "@/lib/progression-queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Delta({ cur, prev }: { cur: number; prev: number }) {
  const pct = percentChange(cur, prev);
  if (pct === null) return <span className="text-xs text-muted-foreground">no baseline</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${up ? "text-[var(--viz-good)]" : "text-muted-foreground"}`}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(Math.round(pct))}% vs. last month
    </span>
  );
}

const TILES: { label: string; key: keyof GroupTotals; icon: LucideIcon; badge: string }[] = [
  { label: "Reading", key: "reading", icon: BookOpen, badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { label: "Listening", key: "listening", icon: Headphones, badge: "bg-teal-500/15 text-teal-600 dark:text-teal-400" },
  { label: "Total", key: "total", icon: Sparkles, badge: "bg-[var(--viz-series-track)] text-[var(--viz-series)]" },
];

/** Reading / listening / total hours this month against the same number of days last month. */
export function MonthCompare({ current, previous }: { current: GroupTotals; previous: GroupTotals }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>This month</CardTitle>
        <CardDescription>Compared to the same period last month</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3">
        {TILES.map((t) => (
          <div key={t.label} className="flex items-start gap-2.5 rounded-lg border p-3">
            <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${t.badge}`}>
              <t.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{t.label}</div>
              <div className="mt-0.5 text-2xl font-semibold tracking-tight">{toHours(current[t.key])}h</div>
              <div className="mt-1">
                <Delta cur={current[t.key]} prev={previous[t.key]} />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
