"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { createGoal, updateGoal, type GoalInput } from "@/actions/goals";
import { GOAL_METRICS, MEDIA_TYPES, type GoalMetric, type MediaType } from "@/db/schema";
import { GOAL_METRIC_LABELS, MEDIA_TYPE_META } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "__all__";
const METRIC_ITEMS: Record<string, string> = { ...GOAL_METRIC_LABELS };
const TYPE_ITEMS: Record<string, string> = { [ALL]: "All media", ...Object.fromEntries(MEDIA_TYPES.map((t) => [t, MEDIA_TYPE_META[t].label])) };

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Period presets computed in the browser's local time — fine for whole-day boundaries. */
function preset(kind: "year" | "month" | "week" | "30d"): [string, string] {
  const now = new Date();
  if (kind === "year") return [`${now.getFullYear()}-01-01`, `${now.getFullYear()}-12-31`];
  if (kind === "month") {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(end)];
  }
  if (kind === "week") {
    const dow = (now.getDay() + 6) % 7;
    const mon = new Date(now);
    mon.setDate(now.getDate() - dow);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return [iso(mon), iso(sun)];
  }
  const end = new Date(now);
  end.setDate(now.getDate() + 29);
  return [iso(now), iso(end)];
}

export function GoalForm({
  goalId,
  initial,
  onDone,
}: {
  goalId?: string;
  initial?: Partial<GoalInput>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [metric, setMetric] = useState<GoalMetric>(initial?.metric ?? "time");
  const [mediaType, setMediaType] = useState<string>(initial?.mediaType || ALL);
  const [year0, year1] = preset("year");
  const [start, setStart] = useState(initial?.startDate ?? year0);
  const [end, setEnd] = useState(initial?.endDate ?? year1);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload: GoalInput = {
      title: String(f.get("title") ?? ""),
      metric,
      mediaType: mediaType === ALL ? null : (mediaType as MediaType),
      target: Number(f.get("target")),
      startDate: start,
      endDate: end,
    };
    startTransition(async () => {
      const res = goalId ? await updateGoal(goalId, payload) : await createGoal(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(goalId ? "Goal updated" : "Goal created");
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="g-title">Name</Label>
        <Input id="g-title" name="title" required maxLength={200} defaultValue={initial?.title ?? ""} placeholder="1000 hours in 2026" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="g-target">Target</Label>
          <Input id="g-target" name="target" type="number" min={1} required defaultValue={initial?.target ?? 1000} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="g-metric">Unit</Label>
          <Select items={METRIC_ITEMS} value={metric} onValueChange={(v) => setMetric(v as GoalMetric)}>
            <SelectTrigger id="g-metric" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOAL_METRICS.map((m) => (
                <SelectItem key={m} value={m}>
                  {GOAL_METRIC_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="g-type">Counting</Label>
          <Select items={TYPE_ITEMS} value={mediaType} onValueChange={(v) => setMediaType(v ?? ALL)}>
            <SelectTrigger id="g-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All media</SelectItem>
              {MEDIA_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {MEDIA_TYPE_META[t].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Period</Label>
        <div className="flex flex-wrap gap-1.5">
          {(["year", "month", "week", "30d"] as const).map((k) => (
            <Button
              key={k}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const [s, e] = preset(k);
                setStart(s);
                setEnd(e);
              }}
            >
              {k === "year" ? "This year" : k === "month" ? "This month" : k === "week" ? "This week" : "Next 30 days"}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required aria-label="Start date" />
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} required aria-label="End date" />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : goalId ? "Save changes" : "Create goal"}
        </Button>
      </div>
    </form>
  );
}
