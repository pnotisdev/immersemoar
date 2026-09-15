import Link from "next/link";
import { Crown } from "lucide-react";
import { formatDuration, formatNumber } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/ranking-queries";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

function Podium({ row, place }: { row: LeaderboardRow; place: 1 | 2 | 3 }) {
  const first = place === 1;
  return (
    <Link href={`/u/${row.userId}`} className={cn("flex flex-col items-center gap-1.5 rounded-lg p-3 text-center hover:bg-muted/50", first && "sm:-mt-4")}>
      <div className="relative">
        <Avatar name={row.name} image={row.image} size={first ? "xl" : "lg"} className={cn("ring-2", first ? "ring-[var(--viz-series)]" : "ring-border")} />
        {first && <Crown className="absolute -top-3 left-1/2 size-5 -translate-x-1/2 text-[var(--viz-series)]" />}
      </div>
      <div className="rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums">{place === 1 ? "1st" : place === 2 ? "2nd" : "3rd"}</div>
      <div className="max-w-32 truncate text-sm font-medium">{row.name}</div>
      <div className="text-xs text-muted-foreground">Lv {row.level.level}</div>
      <div className={cn("font-semibold tabular-nums", first ? "text-xl" : "text-base")}>{formatDuration(row.seconds)}</div>
    </Link>
  );
}

export function Leaderboard({ rows, currentUserId }: { rows: LeaderboardRow[]; currentUserId: string }) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Nobody has logged time in this range yet. Be the first.</p>;
  }
  const [a, b, c] = rows;
  const rest = rows.slice(3);

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-3 items-end gap-2 rounded-xl border bg-muted/30 p-3 sm:px-10">
        <div>{b && <Podium row={b} place={2} />}</div>
        <div>{a && <Podium row={a} place={1} />}</div>
        <div>{c && <Podium row={c} place={3} />}</div>
      </div>

      {rest.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="w-12 px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Learner</th>
                <th className="px-3 py-2 font-medium">Level</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {rest.map((r) => (
                <tr key={r.userId} className={cn("border-b last:border-0", r.userId === currentUserId && "bg-[var(--viz-series-track)]/40")}>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.rank}</td>
                  <td className="px-3 py-2">
                    <Link href={`/u/${r.userId}`} className="flex items-center gap-2 hover:underline">
                      <Avatar name={r.name} image={r.image} size="sm" />
                      <span className="truncate font-medium">{r.name}</span>
                      {r.userId === currentUserId && <span className="text-xs text-muted-foreground">(you)</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full border px-2 py-0.5 text-xs tabular-nums">Lv {r.level.level}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDuration(r.seconds)}</td>
                  <td className="hidden px-3 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">{formatNumber(r.sessions)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
