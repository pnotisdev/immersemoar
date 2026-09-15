import { formatDuration } from "@/lib/format";

export interface HeatmapDay {
  key: string; // YYYY-MM-DD
  seconds: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Mon", "", "Wed", "", "Fri", "", ""];

/** Sequential step 0-5 for a day's seconds, using a fixed scale so the same hour count always reads the same. */
function step(seconds: number): number {
  if (seconds <= 0) return 0;
  const h = seconds / 3600;
  if (h < 0.5) return 1;
  if (h < 1) return 2;
  if (h < 2) return 3;
  if (h < 4) return 4;
  return 5;
}

/**
 * GitHub-style calendar heatmap. `days` must be contiguous, oldest first, and the
 * first entry should be a Monday for the columns to line up (the caller pads it).
 */
export function Heatmap({ days }: { days: HeatmapDay[] }) {
  if (days.length === 0) return null;

  // Columns are weeks; rows are Mon..Sun.
  const firstDow = (new Date(days[0].key + "T00:00:00Z").getUTCDay() + 6) % 7; // Mon=0
  const cells: (HeatmapDay | null)[] = [...Array<null>(firstDow).fill(null), ...days];
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Month label goes on the first week that contains the 1st of a month.
  const monthLabels = weeks.map((w) => {
    const d = w.find((c) => c && c.key.endsWith("-01"));
    return d ? MONTHS[Number(d.key.slice(5, 7)) - 1] : "";
  });

  const CELL = 11;
  const GAP = 2;
  const LEFT = 28;
  const TOP = 16;
  const width = LEFT + weeks.length * (CELL + GAP);
  const height = TOP + 7 * (CELL + GAP);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="block text-[9px]"
        role="img"
        aria-label="Daily immersion heatmap"
      >
        {DOW.map((label, r) =>
          label ? (
            <text key={r} x={0} y={TOP + r * (CELL + GAP) + CELL - 2} fill="var(--viz-muted)">
              {label}
            </text>
          ) : null,
        )}
        {weeks.map((week, c) => (
          <g key={c} transform={`translate(${LEFT + c * (CELL + GAP)}, 0)`}>
            {monthLabels[c] && (
              <text x={0} y={10} fill="var(--viz-muted)">
                {monthLabels[c]}
              </text>
            )}
            {week.map((day, r) =>
              day ? (
                <rect
                  key={day.key}
                  x={0}
                  y={TOP + r * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={2}
                  fill={`var(--viz-seq-${step(day.seconds)})`}
                >
                  <title>{`${day.key}: ${day.seconds > 0 ? formatDuration(day.seconds) : "nothing logged"}`}</title>
                </rect>
              ) : null,
            )}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4, 5].map((s) => (
          <span key={s} className="inline-block size-[10px] rounded-[2px]" style={{ background: `var(--viz-seq-${s})` }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
