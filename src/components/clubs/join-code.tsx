"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { rotateJoinCode } from "@/actions/clubs";
import { Button } from "@/components/ui/button";

/** Owner-only: show, copy and rotate the club's join code. */
export function JoinCode({ clubId, code }: { clubId: string; code: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="text-xs text-muted-foreground">Join code</span>
      <button type="button" className="font-mono tracking-widest" onClick={() => setShown((s) => !s)} title={shown ? "Hide" : "Show"}>
        {shown ? code : "••••••••"}
      </button>
      <Button size="icon-xs" variant="ghost" aria-label="Copy code" onClick={copy}>
        <Copy />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Generate a new code"
        disabled={pending}
        onClick={() => {
          if (!confirm("Generate a new code? The old one stops working.")) return;
          startTransition(async () => {
            const res = await rotateJoinCode(clubId);
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("New code generated");
              router.refresh();
            }
          });
        }}
      >
        <RefreshCw />
      </Button>
    </div>
  );
}
