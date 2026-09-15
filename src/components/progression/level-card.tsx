import Link from "next/link";
import { Flame, Sparkles, Trophy } from "lucide-react";
import type { LevelInfo } from "@/lib/progression";
import { formatDuration, formatNumber } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

/** Compact "Lv 12" pill. */
export function LevelPill({ info, label }: { info: LevelInfo; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums" title={`${formatNumber(info.xp)} XP`}>
      {label && <span className="font-normal text-muted-foreground">{label}</span>}
      Lv {info.level}
    </span>
  );
}

export function LevelCard({ info, reading, listening }: { info: LevelInfo; reading: LevelInfo; listening: LevelInfo }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--viz-series-track)] text-[var(--viz-series)]">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Level</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">{info.level}</span>
              <span className="text-xs text-muted-foreground">{formatNumber(info.xp)} XP</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-[3px] bg-[var(--viz-series-track)]">
              <div className="h-1.5 rounded-[3px] bg-[var(--viz-series)]" style={{ width: `${Math.min(100, info.percent)}%` }} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatNumber(info.xpForNext - info.xpIntoLevel)} XP to Lv {info.level + 1}</span>
              <span className="ml-auto flex gap-1">
                <LevelPill info={reading} label="Reading" />
                <LevelPill info={listening} label="Listening" />
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StreakCard({ current, longest }: { current: number; longest: number }) {
  const alive = current > 0;
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="flex items-start gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${alive ? "bg-orange-500/15 text-orange-500" : "bg-muted text-muted-foreground"}`}>
            <Flame className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Streak</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight">
                {current} day{current === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {alive ? "Keep it going with a session today." : "Log something today to start one."} Longest: {longest} day{longest === 1 ? "" : "s"}.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RankCard({ rank, total, gapToNext, isPublic }: { rank: number | null; total: number; gapToNext: number | null; isPublic: boolean }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Trophy className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted-foreground">Monthly ranking</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{rank ? `#${rank}` : "—"}</span>
              {rank && <span className="text-xs text-muted-foreground">of {total}</span>}
            </div>
            <div className="mt-1.5 text-xs text-muted-foreground">
              {!isPublic ? (
                <Link href="/settings" className="underline underline-offset-4">
                  Profile is private
                </Link>
              ) : rank == null ? (
                "Log time this month to get ranked."
              ) : gapToNext != null ? (
                `${formatDuration(gapToNext)} behind #${rank - 1}`
              ) : (
                "You're in first place."
              )}
              {" · "}
              <Link href="/ranking" className="underline underline-offset-4">
                Rankings
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
