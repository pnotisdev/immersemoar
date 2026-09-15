"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/format";

export interface Column {
  label: string; // axis label
  title?: string; // tooltip label (defaults to label)
  seconds: number;
  emphasized?: boolean; // e.g. "today"
}

/** Nice round upper bound in hours for the y axis. */
function niceMaxHours(maxSeconds: number): number {
  const h = maxSeconds / 3600;
  if (h <= 1) return 1;
  if (h <= 2) return 2;
  if (h <= 4) return 4;
  if (h <= 6) return 6;
  if (h <= 8) return 8;
  if (h <= 12) return 12;
  return Math.ceil(h / 6) * 6;
}

/** Width of the wrapping element, measured after mount so the SVG renders 1:1 (no viewBox text scaling). */
function useContainerWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Single-series column chart of time per bucket. Thin bars, rounded caps, hairline grid, hover tooltips. */
export function ColumnChart({ columns, height = 160 }: { columns: Column[]; height?: number }) {
  const [ref, width] = useContainerWidth<HTMLDivElement>(600);
  const maxH = niceMaxHours(Math.max(0, ...columns.map((c) => c.seconds)));
  const ticks = [0, maxH / 2, maxH];

  const LEFT = 30;
  const BOTTOM = 18;
  const TOP = 6;
  const plotH = height - TOP - BOTTOM;
  const plotW = width - LEFT;
  const band = plotW / Math.max(1, columns.length);
  const barW = Math.min(24, band * 0.6);
  // Skip some x labels when bands get too narrow to fit them.
  const labelEvery = band >= 22 ? 1 : band >= 12 ? 2 : Math.ceil(24 / band);

  const y = (seconds: number) => TOP + plotH - (seconds / 3600 / maxH) * plotH;

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} className="block text-[10px]" role="img" aria-label="Time per day">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={LEFT} x2={width} y1={y(t * 3600)} y2={y(t * 3600)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} strokeWidth={1} />
            <text x={LEFT - 6} y={y(t * 3600) + 3} textAnchor="end" fill="var(--viz-muted)">
              {t}h
            </text>
          </g>
        ))}
        {columns.map((c, i) => {
          const x = LEFT + i * band + (band - barW) / 2;
          const top = y(c.seconds);
          const h = Math.max(0, TOP + plotH - top);
          const r = Math.min(4, h, barW / 2);
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x},${TOP + plotH} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${barW - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`}
                  fill="var(--viz-series)"
                />
              )}
              {/* Hit target wider than the bar */}
              <rect x={LEFT + i * band} y={TOP} width={band} height={plotH} fill="transparent">
                <title>{`${c.title ?? c.label}: ${formatDuration(c.seconds)}`}</title>
              </rect>
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 4} textAnchor="middle" fill="var(--viz-muted)" fontWeight={c.emphasized ? 600 : 400}>
                  {c.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
