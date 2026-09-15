"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { discardTimer, startTimer, stopTimer } from "@/actions/sessions";
import type { MediaType, Unit } from "@/db/schema";
import { formatClock } from "@/lib/format";
import { MEDIA_TYPE_META } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ItemPicker, type PickerValue } from "@/components/library/item-picker";
import type { LibraryPick } from "@/components/library/types";
import { AmountInput } from "@/components/sessions/amount-input";
import { useElapsed } from "./use-elapsed";

export interface ActiveTimerView {
  mediaItemId: string | null;
  mediaType: MediaType;
  label: string | null;
  startedAt: string; // ISO
  title: string | null;
  progressUnit: Unit | null;
}

export function TimerCard({
  timer,
  entries,
  defaultMediaItemId,
}: {
  timer: ActiveTimerView | null;
  entries: LibraryPick[];
  /** Pre-select an item (e.g. on its detail page). */
  defaultMediaItemId?: string;
}) {
  return timer ? <RunningTimer timer={timer} /> : <IdleTimer entries={entries} defaultMediaItemId={defaultMediaItemId} />;
}

function IdleTimer({ entries, defaultMediaItemId }: { entries: LibraryPick[]; defaultMediaItemId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const preset = defaultMediaItemId ? entries.find((e) => e.mediaItemId === defaultMediaItemId) : entries.find((e) => e.status === "active");
  const [pick, setPick] = useState<PickerValue>({
    mediaItemId: preset?.mediaItemId ?? null,
    mediaType: preset?.type ?? "anime",
    label: "",
  });

  function start() {
    startTransition(async () => {
      const res = await startTimer({ mediaItemId: pick.mediaItemId, mediaType: pick.mediaType, label: pick.label });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <ItemPicker entries={entries} value={pick} onChange={setPick} idPrefix="timer" />
        <Button size="lg" onClick={start} disabled={pending} className="w-full sm:w-auto">
          <Play /> Start timer
        </Button>
      </CardContent>
    </Card>
  );
}

function RunningTimer({ timer }: { timer: ActiveTimerView }) {
  const router = useRouter();
  const elapsed = useElapsed(timer.startedAt);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<Unit | null>(timer.progressUnit ?? MEDIA_TYPE_META[timer.mediaType].defaultUnit);
  const [notes, setNotes] = useState("");

  const what = timer.title ?? timer.label ?? MEDIA_TYPE_META[timer.mediaType].label;

  function stop() {
    startTransition(async () => {
      const res = await stopTimer({ amount: amount === "" ? null : Number(amount), amountUnit: amount === "" ? null : unit, notes });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.id ? "Session saved" : "Timer was under 30s, nothing saved");
      setOpen(false);
      router.refresh();
    });
  }

  function discard() {
    startTransition(async () => {
      const res = await discardTimer();
      if (!res.ok) toast.error(res.error);
      else {
        toast("Timer discarded");
        router.refresh();
      }
    });
  }

  return (
    <Card className="border-primary/40">
      <CardContent className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-primary" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{what}</div>
            <div className="text-xs text-muted-foreground">{MEDIA_TYPE_META[timer.mediaType].label}</div>
          </div>
        </div>
        <div className="ml-auto font-mono text-3xl tabular-nums tracking-tight">{formatClock(elapsed)}</div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button onClick={() => setOpen(true)} className="flex-1 sm:flex-none">
            <Square /> Stop
          </Button>
          <Button variant="ghost" size="icon" aria-label="Discard timer" onClick={discard} disabled={pending}>
            <Trash2 />
          </Button>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish session</DialogTitle>
            <DialogDescription>
              {what} · {formatClock(elapsed)}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <AmountInput amount={amount} unit={unit} onChange={(v) => { setAmount(v.amount); setUnit(v.unit); }} idPrefix="stop-amount" />
            <div className="grid gap-1.5">
              <Label htmlFor="stop-notes">Notes (optional)</Label>
              <Textarea id="stop-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Keep going
            </Button>
            <Button onClick={stop} disabled={pending}>
              {pending ? "Saving…" : "Save session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
