import { MEDIA_TYPES, type MediaType } from "@/db/schema";
import { presetRange, type DateRange } from "./dates";
import { GROUP_LABELS, MEDIA_TYPE_META, typesInGroup, type MediaGroup } from "./media";

export const RANKING_PERIODS = ["month", "week", "year", "all"] as const;
export type RankingPeriod = (typeof RANKING_PERIODS)[number];
export const PERIOD_LABELS: Record<RankingPeriod, string> = { month: "This month", week: "This week", year: "This year", all: "All time" };

/** "all", a reading/listening group, or a single media type. */
export type RankingScope = "all" | MediaGroup | MediaType;

export interface ResolvedRanking {
  period: RankingPeriod;
  scope: RankingScope;
  range: DateRange;
  types: MediaType[] | undefined;
  scopeLabel: string;
}

export function resolveRanking(params: { period?: string; scope?: string }, tz: string): ResolvedRanking {
  const period = (RANKING_PERIODS as readonly string[]).includes(params.period ?? "") ? (params.period as RankingPeriod) : "month";
  let scope: RankingScope = "all";
  let types: MediaType[] | undefined;
  let scopeLabel = "All media";
  const s = params.scope ?? "all";
  if (s === "reading" || s === "listening" || s === "other") {
    scope = s;
    types = typesInGroup(s);
    scopeLabel = GROUP_LABELS[s];
  } else if ((MEDIA_TYPES as readonly string[]).includes(s)) {
    scope = s as MediaType;
    types = [s as MediaType];
    scopeLabel = MEDIA_TYPE_META[s as MediaType].label;
  }
  return { period, scope, range: presetRange(period, tz), types, scopeLabel };
}
