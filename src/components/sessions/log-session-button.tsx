"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { MediaType } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LibraryPick } from "@/components/library/types";
import { SessionForm } from "./session-form";

/** "Log session" button that opens the manual/backdated entry form. */
export function LogSessionButton({
  entries,
  tz,
  defaultMediaItemId,
  defaultMediaType,
  variant = "default",
  label = "Log session",
}: {
  entries: LibraryPick[];
  tz: string;
  defaultMediaItemId?: string;
  defaultMediaType?: MediaType;
  variant?: "default" | "outline" | "secondary";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log a session</DialogTitle>
            <DialogDescription>Forgot to start the timer? Backdate it here.</DialogDescription>
          </DialogHeader>
          {open && (
            <SessionForm
              entries={entries}
              tz={tz}
              initial={{ mediaItemId: defaultMediaItemId ?? null, mediaType: defaultMediaType }}
              onDone={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
