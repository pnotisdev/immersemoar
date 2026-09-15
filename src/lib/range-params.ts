import { dayEnd, dayStart, presetRange, type DateRange, type RangePreset } from "./dates";

const PRESETS: RangePreset[] = ["today", "week", "month", "year", "7d", "30d", "365d", "all"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ResolvedRange extends DateRange {
  preset: RangePreset | "custom";
  fromKey?: string;
  toKey?: string;
}

/** Resolve ?range=…&from=…&to=… search params into concrete instants. Defaults to `fallback`. */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  tz: string,
  fallback: RangePreset = "week",
): ResolvedRange {
  if (params.range === "custom" && params.from && params.to && DATE_RE.test(params.from) && DATE_RE.test(params.to)) {
    const from = dayStart(params.from, tz);
    const to = dayEnd(params.to, tz);
    if (to > from) {
      return { preset: "custom", from, to, label: `${params.from} – ${params.to}`, fromKey: params.from, toKey: params.to };
    }
  }
  const preset = PRESETS.includes(params.range as RangePreset) ? (params.range as RangePreset) : fallback;
  return { preset, ...presetRange(preset, tz) };
}
