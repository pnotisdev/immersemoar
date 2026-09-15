import type { EntryStatus, MediaType, Unit } from "@/db/schema";

/** Minimal library entry shape passed to client pickers (timer, session form). */
export interface LibraryPick {
  mediaItemId: string;
  title: string;
  titleNative: string | null;
  type: MediaType;
  status: EntryStatus;
  progressUnit: Unit | null;
  coverUrl: string | null;
}
