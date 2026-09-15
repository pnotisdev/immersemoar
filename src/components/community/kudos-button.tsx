"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { toggleKudos } from "@/actions/social";
import { cn } from "@/lib/utils";

/** The one reaction in the app: a heart on someone's session. */
export function KudosButton({
  sessionId,
  initialCount,
  initialGiven,
  disabled = false,
}: {
  sessionId: string;
  initialCount: number;
  initialGiven: boolean;
  /** Your own sessions can't be hearted; the count still shows. */
  disabled?: boolean;
}) {
  const [given, setGiven] = useState(initialGiven);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !given;
    setGiven(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      const res = await toggleKudos(sessionId);
      if (!res.ok) {
        setGiven(!next);
        setCount((c) => c + (next ? -1 : 1));
        toast.error(res.error);
      }
    });
  }

  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Kudos received">
        <Heart className={cn("size-3.5", count > 0 && "fill-rose-500/70 text-rose-500/70")} />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={given}
      aria-label={given ? "Remove kudos" : "Give kudos"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 -ml-1.5 text-xs transition-colors hover:bg-muted",
        given ? "text-rose-500" : "text-muted-foreground",
      )}
    >
      <Heart className={cn("size-3.5 transition-transform", given && "scale-110 fill-rose-500")} />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
