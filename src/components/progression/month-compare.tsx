import { ArrowDownRight, ArrowUpRight } from "lucide-react";
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

/** Reading / listening / total hours this month against the same number of days last month. */
export function MonthCompare({ current, previous }: { current: GroupTotals; previous: GroupTotals }) {
  const tiles: { label: string; cur: number; prev: number }[] = [
    { label: "Reading", cur: current.reading, prev: previous.reading },
    { label: "Listening", cur: current.listening, prev: previous.listening },
    { label: "Total", cur: current.total, prev: previous.total },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>This month</CardTitle>
        <CardDescription>Compared to the same period last month</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border p-3">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{toHours(t.cur)}h</div>
            <div className="mt-1">
              <Delta cur={t.cur} prev={t.prev} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
