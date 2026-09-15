"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeEntry, updateEntry, updateMediaItem } from "@/actions/library";
import { ENTRY_STATUSES, UNITS, type EntryStatus, type Unit } from "@/db/schema";
import { STATUS_LABELS, UNIT_LABELS } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_ITEMS: Record<string, string> = { ...STATUS_LABELS };
const NONE = "__none__";
const UNIT_ITEMS: Record<string, string> = { [NONE]: "no unit", ...UNIT_LABELS };
const RATING_ITEMS: Record<string, string> = { [NONE]: "—", ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i + 1), `${i + 1} / 10`])) };

export interface EntryEditorData {
  mediaItemId: string;
  status: EntryStatus;
  progress: number;
  progressUnit: Unit | null;
  rating: number | null;
  notes: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  totalAmount: number | null;
  totalUnit: Unit | null;
  canEditTotal: boolean;
}

export function EntryEditor({ entry }: { entry: EntryEditorData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<EntryStatus>(entry.status);
  const [progress, setProgress] = useState(String(entry.progress));
  const [unit, setUnit] = useState<Unit | null>(entry.progressUnit);
  const [rating, setRating] = useState<string>(entry.rating ? String(entry.rating) : NONE);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [startedAt, setStartedAt] = useState(entry.startedAt ?? "");
  const [finishedAt, setFinishedAt] = useState(entry.finishedAt ?? "");
  const [total, setTotal] = useState(entry.totalAmount ? String(entry.totalAmount) : "");
  const [totalUnit, setTotalUnit] = useState<Unit | null>(entry.totalUnit);
  // Progress can never exceed a known total in the same unit.
  const effectiveTotal = entry.canEditTotal ? (total === "" ? null : Number(total)) : entry.totalAmount;
  const effectiveTotalUnit = entry.canEditTotal ? totalUnit : entry.totalUnit;
  const maxProgress = effectiveTotal && effectiveTotalUnit === unit ? effectiveTotal : undefined;

  function save() {
    startTransition(async () => {
      const res = await updateEntry(entry.mediaItemId, {
        status,
        progress: Math.min(Number(progress) || 0, maxProgress ?? Infinity),
        progressUnit: unit,
        rating: rating === NONE ? null : Number(rating),
        notes: notes || null,
        startedAt: startedAt || null,
        finishedAt: finishedAt || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (entry.canEditTotal && (total !== (entry.totalAmount ? String(entry.totalAmount) : "") || totalUnit !== entry.totalUnit)) {
        const r2 = await updateMediaItem(entry.mediaItemId, { totalAmount: total === "" ? null : Number(total), totalUnit });
        if (!r2.ok) toast.error(r2.error);
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  function remove() {
    if (!confirm("Remove from your library? Logged sessions are kept.")) return;
    startTransition(async () => {
      const res = await removeEntry(entry.mediaItemId);
      if (!res.ok) toast.error(res.error);
      else {
        toast("Removed from library");
        router.push("/library");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="e-status">Status</Label>
          <Select items={STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v as EntryStatus)}>
            <SelectTrigger id="e-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ENTRY_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="e-rating">Rating</Label>
          <Select items={RATING_ITEMS} value={rating} onValueChange={(v) => setRating(v ?? NONE)}>
            <SelectTrigger id="e-rating" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RATING_ITEMS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="e-progress">Progress</Label>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <Input id="e-progress" type="number" min={0} max={maxProgress} value={progress} onChange={(e) => setProgress(e.target.value)} />
          <Select items={UNIT_ITEMS} value={unit ?? NONE} onValueChange={(v) => setUnit(v === NONE ? null : (v as Unit))}>
            <SelectTrigger aria-label="Progress unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>no unit</SelectItem>
              {UNITS.map((u) => (
                <SelectItem key={u} value={u}>
                  {UNIT_LABELS[u]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {maxProgress != null && `of ${maxProgress} ${UNIT_LABELS[unit!]} · `}Sessions logged with a matching unit add to this automatically.
        </p>
      </div>

      {!entry.canEditTotal && entry.totalAmount && entry.totalUnit && (
        <p className="text-xs text-muted-foreground">Total length: {entry.totalAmount} {UNIT_LABELS[entry.totalUnit]} (from the source).</p>
      )}

      {entry.canEditTotal && (
        <div className="grid gap-1.5">
          <Label htmlFor="e-total">Total length</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <Input id="e-total" type="number" min={1} value={total} onChange={(e) => setTotal(e.target.value)} placeholder="unknown" />
            <Select items={UNIT_ITEMS} value={totalUnit ?? NONE} onValueChange={(v) => setTotalUnit(v === NONE ? null : (v as Unit))}>
              <SelectTrigger aria-label="Total unit" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>no unit</SelectItem>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {UNIT_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="e-started">Started</Label>
          <Input id="e-started" type="date" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="e-finished">Finished</Label>
          <Input id="e-finished" type="date" value={finishedAt} onChange={(e) => setFinishedAt(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="e-notes">Notes</Label>
        <Textarea id="e-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Difficulty, where to find it, thoughts…" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={remove} disabled={pending} className="text-muted-foreground">
          Remove from library
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
