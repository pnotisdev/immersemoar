import type { MediaType, Unit } from "@/db/schema";
import type { SessionWithItem } from "@/lib/queries";

/** Serializable session for client components. */
export interface SessionView {
  id: string;
  mediaItemId: string | null;
  mediaType: MediaType;
  label: string | null;
  startedAt: string; // ISO
  durationSeconds: number;
  amount: number | null;
  amountUnit: Unit | null;
  notes: string | null;
  title: string | null;
  coverUrl: string | null;
}

export function toSessionView(s: SessionWithItem): SessionView {
  return {
    id: s.id,
    mediaItemId: s.mediaItemId,
    mediaType: s.mediaType,
    label: s.label,
    startedAt: s.startedAt.toISOString(),
    durationSeconds: s.durationSeconds,
    amount: s.amount,
    amountUnit: s.amountUnit,
    notes: s.notes,
    title: s.mediaItem?.title ?? null,
    coverUrl: s.mediaItem?.coverUrl ?? null,
  };
}
