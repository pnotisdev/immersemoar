import Link from "next/link";
import type { ReactNode } from "react";
import type { GoalWithProgress } from "@/lib/queries";
import { formatNumber } from "@/lib/format";
import { GOAL_METRIC_LABELS, MEDIA_TYPE_META } from "@/lib/media";
import { Card, CardContent } from "@/components/ui/card";
import { GoalMeter } from "./goal-meter";

function fmt(n: number, metric: GoalWithProgress["metric"]) {
  return metric === "time" ? (Math.round(n * 10) / 10).toLocaleString("en") : formatNumber(Math.round(n));
}

export function GoalCard({ goal, actions, compact = false }: { goal: GoalWithProgress; actions?: ReactNode; compact?: boolean }) {
  const unit = GOAL_METRIC_LABELS[goal.metric];
  const scope = goal.mediaType ? MEDIA_TYPE_META[goal.mediaType].label : "All media";
  const ahead = goal.percent - goal.expectedPercent;
  const done = goal.current >= goal.target;

  return (
    <Card className={compact ? "py-4" : undefined}>
      <CardContent className={compact ? "px-4" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/goals" className="block truncate font-medium hover:underline">
              {goal.title}
            </Link>
            <div className="text-xs text-muted-foreground">
              {scope} · {goal.startDate} → {goal.endDate}
            </div>
          </div>
          {actions}
        </div>

        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight">{fmt(goal.current, goal.metric)}</span>
          <span className="text-sm text-muted-foreground">
            / {fmt(goal.target, goal.metric)} {unit}
          </span>
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">{Math.round(goal.percent)}%</span>
        </div>
        <div className="mt-2">
          <GoalMeter percent={goal.percent} expectedPercent={goal.isActive ? goal.expectedPercent : undefined} />
        </div>

        <div className="mt-2 text-xs text-muted-foreground">
          {done ? (
            <span className="text-[var(--viz-good)]">Goal reached 🎉</span>
          ) : goal.isPast ? (
            <>Ended · {fmt(goal.remaining, goal.metric)} {unit} short</>
          ) : goal.isActive ? (
            <>
              {goal.daysLeft} day{goal.daysLeft === 1 ? "" : "s"} left · need {fmt(goal.perDayNeeded, goal.metric)} {unit}/day
              {" · "}
              <span className={ahead >= 0 ? "text-[var(--viz-good)]" : ""}>
                {ahead >= 0 ? "ahead of" : "behind"} pace by {Math.abs(Math.round(ahead))}%
              </span>
            </>
          ) : (
            <>Starts {goal.startDate}</>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
