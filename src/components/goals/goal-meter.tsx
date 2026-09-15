/** Progress meter: filled track in the series hue, unfilled track a lighter step of the same ramp.
 *  The pace tick marks where you'd be if spreading the goal evenly over its period. */
export function GoalMeter({ percent, expectedPercent }: { percent: number; expectedPercent?: number }) {
  const p = Math.max(0, Math.min(100, percent));
  const e = expectedPercent == null ? null : Math.max(0, Math.min(100, expectedPercent));
  return (
    <div className="relative h-2.5 w-full rounded-[4px] bg-[var(--viz-series-track)]" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-[4px] bg-[var(--viz-series)]" style={{ width: `${p}%` }} />
      {e != null && e > 0 && e < 100 && (
        <div
          className="absolute -top-1 h-[18px] w-0.5 bg-foreground/60"
          style={{ left: `calc(${e}% - 1px)` }}
          title={`On-pace mark: ${Math.round(e)}%`}
        />
      )}
    </div>
  );
}
