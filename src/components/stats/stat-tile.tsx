import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export type StatTone = "default" | "accent" | "streak" | "reading" | "listening" | "gold";

const TONE_CLASSES: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  accent: "bg-[var(--viz-series-track)] text-[var(--viz-series)]",
  streak: "bg-orange-500/15 text-orange-500",
  reading: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  listening: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  gold: "bg-amber-500/15 text-amber-500",
};

/** Label + value (+ optional hint), with an optional colored icon badge for at-a-glance category recognition. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
}) {
  return (
    <Card className="py-4">
      <CardContent className="flex items-start gap-3 px-4">
        {Icon && (
          <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}>
            <Icon className="size-4.5" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
