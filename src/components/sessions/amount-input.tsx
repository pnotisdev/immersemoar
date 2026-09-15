"use client";

import { UNITS, type Unit } from "@/db/schema";
import { UNIT_LABELS } from "@/lib/media";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";
const ITEMS: Record<string, string> = { [NONE]: "no unit", ...UNIT_LABELS };

/** "How much" in native units: 3 episodes, 45 pages, 12000 characters. Optional. */
export function AmountInput({
  amount,
  unit,
  onChange,
  idPrefix = "amount",
}: {
  amount: string;
  unit: Unit | null;
  onChange: (v: { amount: string; unit: Unit | null }) => void;
  idPrefix?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${idPrefix}-value`}>Amount (optional)</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <Input
          id={`${idPrefix}-value`}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="0"
          value={amount}
          onChange={(e) => onChange({ amount: e.target.value, unit })}
        />
        <Select items={ITEMS} value={unit ?? NONE} onValueChange={(v) => onChange({ amount, unit: v === NONE ? null : (v as Unit) })}>
          <SelectTrigger aria-label="Unit" className="w-full">
            <SelectValue placeholder="unit" />
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
  );
}
