"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { createSession, updateSession } from "@/actions/sessions";
import type { MediaType, Unit } from "@/db/schema";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/dates";
import { MEDIA_TYPE_META } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ItemPicker, type PickerValue } from "@/components/library/item-picker";
import type { LibraryPick } from "@/components/library/types";
import { AmountInput } from "./amount-input";

export interface SessionFormValues {
  mediaItemId: string | null;
  mediaType: MediaType;
  label: string;
  startedAt: Date;
  durationSeconds: number;
  amount: number | null;
  amountUnit: Unit | null;
  notes: string;
}

function defaultUnitFor(entries: LibraryPick[], mediaItemId: string | null, mediaType: MediaType): Unit | null {
  const e = mediaItemId ? entries.find((x) => x.mediaItemId === mediaItemId) : null;
  return e?.progressUnit ?? MEDIA_TYPE_META[mediaType].defaultUnit;
}

export function SessionForm({
  entries,
  tz,
  sessionId,
  initial,
  onDone,
}: {
  entries: LibraryPick[];
  tz: string;
  /** Present when editing. */
  sessionId?: string;
  initial?: Partial<SessionFormValues>;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [pick, setPick] = useState<PickerValue>({
    mediaItemId: initial?.mediaItemId ?? null,
    mediaType: initial?.mediaType ?? "anime",
    label: initial?.label ?? "",
  });
  const initialDuration = initial?.durationSeconds ?? 30 * 60;
  const [startedAt, setStartedAt] = useState(() =>
    toLocalInputValue(initial?.startedAt ?? new Date(Date.now() - initialDuration * 1000), tz),
  );
  const [hours, setHours] = useState(String(Math.floor(initialDuration / 3600)));
  const [minutes, setMinutes] = useState(String(Math.round((initialDuration % 3600) / 60)));
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : "");
  const [unit, setUnit] = useState<Unit | null>(
    initial?.amountUnit !== undefined ? initial.amountUnit : defaultUnitFor(entries, pick.mediaItemId, pick.mediaType),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function onPickChange(v: PickerValue) {
    setPick(v);
    // Follow the item's unit unless the user has typed an amount already.
    if (!amount) setUnit(defaultUnitFor(entries, v.mediaItemId, v.mediaType));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const durationSeconds = (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
    if (durationSeconds < 60) {
      toast.error("Duration must be at least a minute");
      return;
    }
    const payload = {
      mediaItemId: pick.mediaItemId,
      mediaType: pick.mediaType,
      label: pick.mediaItemId ? null : pick.label,
      startedAt: fromLocalInputValue(startedAt, tz).toISOString(),
      durationSeconds,
      amount: amount === "" ? null : Number(amount),
      amountUnit: amount === "" ? null : unit,
      notes,
    };
    startTransition(async () => {
      const res = sessionId ? await updateSession(sessionId, payload) : await createSession(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(sessionId ? "Session updated" : "Session logged");
      router.refresh();
      onDone?.();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <ItemPicker entries={entries} value={pick} onChange={onPickChange} idPrefix={sessionId ? "edit" : "new"} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="started">Started</Label>
          <Input id="started" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Duration</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <Input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours" className="pr-8" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">h</span>
            </div>
            <div className="relative">
              <Input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" className="pr-8" />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">m</span>
            </div>
          </div>
        </div>
      </div>

      <AmountInput amount={amount} unit={unit} onChange={(v) => { setAmount(v.amount); setUnit(v.unit); }} />

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="New words, how it felt, where you stopped…" />
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : sessionId ? "Save changes" : "Log session"}
        </Button>
      </div>
    </form>
  );
}
