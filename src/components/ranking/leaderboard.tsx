import Link from "next/link";
import { formatDuration, formatNumber } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/ranking-queries";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

/** Muted metal tones for the first three; everyone else gets plain numerals. */
const MEDAL: Record<number, string> = {
  1: "text-amber-500",
  2: "text-zinc-400",
  3: "text-orange-700 dark:text-orange-400/90",
};

function Row({ row, max, isViewer }: { row: LeaderboardRow; max: number; isViewer: boolean }) {
  const share = Math.max(2, (row.seconds / max) * 100);
  return (
    <li className="relative">
      {/* The bar is the ranking: length is time logged, relative to the leader. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 rounded-r-md",
          isViewer ? "bg-primary/15" : "bg-muted/70",
        )}
        style={{ width: `${share}%` }}
      />
      <Link
        href={`/u/${row.username}`}
        className="relative flex items-center gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-foreground/[0.04]"
      >
        <span className={cn("w-6 shrink-0 text-center text-sm font-semibold tabular-nums", MEDAL[row.rank] ?? "text-muted-foreground")}>
          {row.rank}
        </span>
        <Avatar name={row.name} image={row.image} size="sm" className={cn(row.rank === 1 && "ring-2 ring-amber-400/70")} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {row.name}
          {isViewer && <span className="ml-1.5 text-xs font-normal text-muted-foreground">you</span>}
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">Lv {row.level.level}</span>
        <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground tabular-nums md:inline">
          {formatNumber(row.sessions)} sessions
        </span>
        <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">{formatDuration(row.seconds)}</span>
      </Link>
    </li>
  );
}

export function Leaderboard({
  rows,
  currentUserId,
  emptyText = "Nobody has logged time in this range yet. Be the first.",
}: {
  rows: LeaderboardRow[];
  currentUserId: string;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(...rows.map((r) => r.seconds), 1);

  return (
    <ol className="grid">
      {rows.map((r) => (
        <Row key={r.userId} row={r} max={max} isViewer={r.userId === currentUserId} />
      ))}
    </ol>
  );
}
