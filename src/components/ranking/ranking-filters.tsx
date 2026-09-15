import Link from "next/link";
import { MEDIA_TYPES } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { PERIOD_LABELS, RANKING_PERIODS, type RankingPeriod, type RankingScope } from "@/lib/ranking-params";
import { cn } from "@/lib/utils";

const SCOPES: { key: RankingScope; label: string }[] = [
  { key: "all", label: "Global" },
  { key: "reading", label: "Reading" },
  { key: "listening", label: "Listening" },
  ...MEDIA_TYPES.map((t) => ({ key: t as RankingScope, label: MEDIA_TYPE_META[t].label })),
];

/** Link-based filters so the page stays a plain server render. */
export function RankingFilters({ basePath, period, scope }: { basePath: string; period: RankingPeriod; scope: RankingScope }) {
  const href = (p: RankingPeriod, s: RankingScope) => {
    const q = new URLSearchParams();
    if (p !== "month") q.set("period", p);
    if (s !== "all") q.set("scope", s);
    const qs = q.toString();
    return `${basePath}${qs ? `?${qs}` : ""}`;
  };
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1 rounded-lg border p-1 w-fit">
        {RANKING_PERIODS.map((p) => (
          <Link key={p} href={href(p, scope)} className={cn("rounded-md px-2.5 py-1 text-sm", period === p ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
            {PERIOD_LABELS[p]}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SCOPES.map((s) => (
          <Link key={s.key} href={href(period, s.key)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", scope === s.key && "bg-muted font-medium")}>
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
