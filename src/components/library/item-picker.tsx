"use client";

import { MEDIA_TYPES, type MediaType } from "@/db/schema";
import { MEDIA_TYPE_META, STATUS_LABELS } from "@/lib/media";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { LibraryPick } from "./types";

export const NO_ITEM = "__none__";

const STATUS_ORDER = ["active", "paused", "planning", "finished", "dropped"] as const;
const TYPE_LABELS: Record<string, string> = Object.fromEntries(MEDIA_TYPES.map((t) => [t, MEDIA_TYPE_META[t].label]));

export interface PickerValue {
  mediaItemId: string | null;
  mediaType: MediaType;
  label: string;
}

/**
 * Choose what a session/timer is for: either a library item (type is inferred)
 * or a free-form "type + label" for things that aren't in the library.
 */
export function ItemPicker({
  entries,
  value,
  onChange,
  idPrefix = "picker",
}: {
  entries: LibraryPick[];
  value: PickerValue;
  onChange: (v: PickerValue) => void;
  idPrefix?: string;
}) {
  const grouped = STATUS_ORDER.map((s) => ({ status: s, items: entries.filter((e) => e.status === s) })).filter(
    (g) => g.items.length > 0,
  );
  // Base UI renders the selected label from this map (needed for SSR / hydration).
  const itemLabels: Record<string, string> = { [NO_ITEM]: "Something not in my library…" };
  for (const e of entries) itemLabels[e.mediaItemId] = e.title;

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-item`}>What</Label>
        <Select
          items={itemLabels}
          value={value.mediaItemId ?? NO_ITEM}
          onValueChange={(v) => {
            if (v === NO_ITEM) {
              onChange({ ...value, mediaItemId: null });
            } else {
              const e = entries.find((x) => x.mediaItemId === v);
              onChange({ mediaItemId: v, mediaType: e?.type ?? value.mediaType, label: "" });
            }
          }}
        >
          <SelectTrigger id={`${idPrefix}-item`} className="w-full">
            <SelectValue placeholder="Pick from your library" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ITEM}>Something not in my library…</SelectItem>
            {grouped.map((g) => (
              <SelectGroup key={g.status}>
                <SelectLabel>{STATUS_LABELS[g.status]}</SelectLabel>
                {g.items.map((e) => (
                  <SelectItem key={e.mediaItemId} value={e.mediaItemId}>
                    <span className="truncate">{e.title}</span>
                    <span className="ml-1 text-xs text-muted-foreground">· {MEDIA_TYPE_META[e.type].label}</span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.mediaItemId === null && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-type`}>Type</Label>
            <Select items={TYPE_LABELS} value={value.mediaType} onValueChange={(v) => onChange({ ...value, mediaType: v as MediaType })}>
              <SelectTrigger id={`${idPrefix}-type`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEDIA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {MEDIA_TYPE_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-label`}>Label</Label>
            <Input
              id={`${idPrefix}-label`}
              placeholder="e.g. Tutor session, NHK Easy"
              value={value.label}
              onChange={(e) => onChange({ ...value, label: e.target.value })}
              maxLength={200}
            />
          </div>
        </div>
      )}
    </div>
  );
}
