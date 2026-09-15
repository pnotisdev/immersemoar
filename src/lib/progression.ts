/**
 * XP and levels are derived purely from logged time so every medium is worth the same
 * and nothing can be gamed by inflating amounts: 1 XP per minute of immersion.
 *
 * Level curve: level = floor(sqrt(hours)) + 1
 *   10 h  -> Lv 4     100 h -> Lv 11     500 h -> Lv 23
 *   1000 h -> Lv 32   2000 h -> Lv 45    3000 h -> Lv 55
 */

export const XP_PER_MINUTE = 1;

export function xpFromSeconds(seconds: number): number {
  return Math.floor((seconds / 60) * XP_PER_MINUTE);
}

/** Cumulative XP required to *reach* a level. Level 1 = 0 XP. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return (l - 1) * (l - 1) * 60;
}

export interface LevelInfo {
  level: number;
  xp: number;
  /** XP into the current level. */
  xpIntoLevel: number;
  /** XP span of the current level. */
  xpForNext: number;
  /** 0-100 */
  percent: number;
}

export function levelFromXp(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safe / 60)) + 1;
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = ceil - floor;
  return {
    level,
    xp: safe,
    xpIntoLevel: safe - floor,
    xpForNext: span,
    percent: span > 0 ? ((safe - floor) / span) * 100 : 100,
  };
}

export function levelFromSeconds(seconds: number): LevelInfo {
  return levelFromXp(xpFromSeconds(seconds));
}

/** Percent change from `prev` to `cur`; null when there is no baseline. */
export function percentChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** Longest run of consecutive active days in a set of "YYYY-MM-DD" keys. */
export function longestStreak(activeDays: Iterable<string>): number {
  const keys = [...activeDays].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of keys) {
    if (prev && nextDay(prev) === k) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

function nextDay(key: string): string {
  const d = new Date(key + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
