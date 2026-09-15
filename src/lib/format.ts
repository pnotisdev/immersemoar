/** 5400 -> "1h 30m"; 90 -> "1m"; 0 -> "0m". Compact, for lists and stat tiles. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** 5400 -> "01:30:00" for the live timer. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Hours with one decimal: 5400 -> "1.5". */
export function toHours(seconds: number, digits = 1): string {
  return (seconds / 3600).toFixed(digits);
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const full = new Intl.NumberFormat("en");

/** 1234567 -> "1.2M" */
export function formatCompact(n: number) {
  return compact.format(n);
}

export function formatNumber(n: number) {
  return full.format(n);
}

/** "just now", "12m ago", "3h ago", "2d ago", "5w ago" relative to `now`. */
export function relativeTime(date: Date | string, now = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 6) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `${mo}mo ago` : `${Math.floor(d / 365)}y ago`;
}
