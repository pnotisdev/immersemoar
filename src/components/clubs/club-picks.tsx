"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { proposePick, removePick, setPickStatus, toggleVote } from "@/actions/clubs";
import type { MediaType, PickStatus } from "@/db/schema";
import { MEDIA_TYPE_META } from "@/lib/media";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LibraryPick } from "@/components/library/types";

export interface PickView {
  id: string;
  status: PickStatus;
  votes: number;
  voted: boolean;
  proposer: { id: string; name: string };
  mediaItem: { id: string; title: string; titleNative: string | null; coverUrl: string | null; type: MediaType };
}

export function ClubPicks({
  clubId,
  picks,
  library,
  viewerId,
  isOwner,
  isMember,
}: {
  clubId: string;
  picks: PickView[];
  library: LibraryPick[];
  viewerId: string;
  isOwner: boolean;
  isMember: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [proposing, setProposing] = useState(false);
  const [q, setQ] = useState("");

  const current = picks.find((p) => p.status === "current");
  const proposed = picks.filter((p) => p.status === "proposed");
  const done = picks.filter((p) => p.status === "done");
  const alreadyPicked = new Set(picks.map((p) => p.mediaItem.id));
  const candidates = library.filter((l) => !alreadyPicked.has(l.mediaItemId) && (!q || l.title.toLowerCase().includes(q.toLowerCase()))).slice(0, 12);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong");
      else {
        if (okMsg) toast.success(okMsg);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-5">
      {current ? (
        <div className="flex gap-4 rounded-lg border border-[var(--viz-series)]/40 bg-[var(--viz-series-track)]/30 p-3">
          <Cover item={current.mediaItem} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Now reading / watching</div>
            <Link href={`/media/${current.mediaItem.id}`} className="block truncate text-lg font-semibold hover:underline">
              {current.mediaItem.title}
            </Link>
            {current.mediaItem.titleNative && (
              <div className="truncate text-sm text-muted-foreground" lang="ja">
                {current.mediaItem.titleNative}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground">
              {MEDIA_TYPE_META[current.mediaItem.type].label} · {current.votes} vote{current.votes === 1 ? "" : "s"} · proposed by {current.proposer.name}
            </div>
            {isOwner && (
              <div className="mt-2">
                <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => setPickStatus(current.id, "done"), "Marked as finished")}>
                  <Check /> Mark finished
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Nothing chosen yet. {isOwner ? "Promote the most-voted proposal below." : "Vote on a proposal or add one."}
        </p>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Proposals · vote for what&apos;s next</h3>
          {isMember && (
            <Button size="sm" variant="outline" onClick={() => setProposing(true)}>
              <Plus /> Propose
            </Button>
          )}
        </div>
        {proposed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No proposals yet.</p>
        ) : (
          <ul className="grid gap-1.5">
            {proposed.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-md border p-2">
                <button
                  type="button"
                  disabled={!isMember || pending}
                  onClick={() => run(() => toggleVote(p.id))}
                  className={cn(
                    "flex w-11 shrink-0 flex-col items-center rounded-md border py-1 text-xs tabular-nums disabled:opacity-60",
                    p.voted ? "border-[var(--viz-series)] bg-[var(--viz-series-track)]/40 text-foreground" : "hover:bg-muted",
                  )}
                  aria-pressed={p.voted}
                  title={p.voted ? "Remove your vote" : "Vote"}
                >
                  <ChevronUp className="size-4" />
                  {p.votes}
                </button>
                <Cover item={p.mediaItem} />
                <div className="min-w-0 flex-1">
                  <Link href={`/media/${p.mediaItem.id}`} className="block truncate text-sm font-medium hover:underline">
                    {p.mediaItem.title}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {MEDIA_TYPE_META[p.mediaItem.type].label} · by {p.proposer.name}
                  </div>
                </div>
                {isOwner && (
                  <Button size="xs" variant="outline" disabled={pending} onClick={() => run(() => setPickStatus(p.id, "current"), "Set as current pick")}>
                    Choose
                  </Button>
                )}
                {(isOwner || p.proposer.id === viewerId) && (
                  <Button size="icon-xs" variant="ghost" aria-label="Remove proposal" disabled={pending} onClick={() => run(() => removePick(p.id))}>
                    <Trash2 />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">Finished together</h3>
          <ul className="flex flex-wrap gap-1.5">
            {done.map((p) => (
              <li key={p.id}>
                <Link href={`/media/${p.mediaItem.id}`}>
                  <Badge variant="secondary">{p.mediaItem.title}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={proposing} onOpenChange={setProposing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose something</DialogTitle>
            <DialogDescription>Pick from your library. Add it there first if it&apos;s missing.</DialogDescription>
          </DialogHeader>
          <Input autoFocus placeholder="Filter your library…" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="grid max-h-80 gap-0.5 overflow-y-auto">
            {candidates.length === 0 && <li className="p-2 text-sm text-muted-foreground">Nothing matches.</li>}
            {candidates.map((c) => (
              <li key={c.mediaItemId}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const r = await proposePick(clubId, c.mediaItemId);
                      if (r.ok) setProposing(false);
                      return r;
                    }, "Proposed")
                  }
                  className="flex w-full items-center gap-3 rounded-md p-1.5 text-left hover:bg-muted/50 disabled:opacity-50"
                >
                  <div className="h-10 w-7 shrink-0 overflow-hidden rounded-sm bg-muted">
                    {c.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{MEDIA_TYPE_META[c.type].label}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Cover({ item, size = "sm" }: { item: PickView["mediaItem"]; size?: "sm" | "lg" }) {
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-sm bg-muted", size === "lg" ? "h-24 w-16 rounded-md" : "h-12 w-8")}>
      {item.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      )}
    </div>
  );
}
