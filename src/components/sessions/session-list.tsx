"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSession } from "@/actions/sessions";
import { formatDuration, formatNumber } from "@/lib/format";
import { MEDIA_TYPE_META, unitLabel } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Thumb } from "@/components/media/poster";
import type { LibraryPick } from "@/components/library/types";
import { SessionForm } from "./session-form";
import type { SessionView } from "./types";

function dayFormatter(tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function timeFormatter(tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
}
function keyFormatter(tz: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
}

export function SessionList({
  sessions,
  entries,
  tz,
  groupByDay = true,
  emptyText = "No sessions yet.",
}: {
  sessions: SessionView[];
  entries: LibraryPick[];
  tz: string;
  groupByDay?: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<SessionView | null>(null);
  const [pending, startTransition] = useTransition();

  const fmt = useMemo(() => ({ day: dayFormatter(tz), time: timeFormatter(tz), key: keyFormatter(tz) }), [tz]);

  const groups = useMemo(() => {
    if (!groupByDay) return [{ key: "", label: "", items: sessions, seconds: 0 }];
    const map = new Map<string, { key: string; label: string; items: SessionView[]; seconds: number }>();
    for (const s of sessions) {
      const d = new Date(s.startedAt);
      const key = fmt.key.format(d);
      const g = map.get(key) ?? { key, label: fmt.day.format(d), items: [], seconds: 0 };
      g.items.push(s);
      g.seconds += s.durationSeconds;
      map.set(key, g);
    }
    return [...map.values()];
  }, [sessions, groupByDay, fmt]);

  function remove(id: string) {
    if (!confirm("Delete this session?")) return;
    startTransition(async () => {
      const res = await deleteSession(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast("Session deleted");
        router.refresh();
      }
    });
  }

  if (sessions.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  return (
    <div className="grid gap-5">
      {groups.map((g) => (
        <section key={g.key}>
          {groupByDay && (
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <h3 className="font-medium">{g.label}</h3>
              <span className="tabular-nums text-muted-foreground">{formatDuration(g.seconds)}</span>
            </div>
          )}
          <ul className="divide-y rounded-xl border">
            {g.items.map((s) => {
              const what = s.title ?? s.label ?? MEDIA_TYPE_META[s.mediaType].label;
              return (
                <li key={s.id} className="group flex items-center gap-3 px-3 py-2.5">
                  <Thumb src={s.coverUrl} title={what} size="sm" />
                  <div className="min-w-0 flex-1">
                    {s.mediaItemId ? (
                      <Link href={`/media/${s.mediaItemId}`} className="block truncate text-sm font-medium hover:underline">
                        {what}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium">{what}</span>
                    )}
                    <div className="truncate text-xs text-muted-foreground">
                      {MEDIA_TYPE_META[s.mediaType].label} · {fmt.time.format(new Date(s.startedAt))}
                      {s.amount != null && s.amount > 0 && s.amountUnit && (
                        <>
                          {" · "}
                          {formatNumber(s.amount)} {unitLabel(s.amountUnit, s.amount)}
                        </>
                      )}
                      {s.notes && <> · {s.notes}</>}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm tabular-nums">{formatDuration(s.durationSeconds)}</div>
                  {/* Row actions stay out of the way until the row is hovered or focused. */}
                  <div className="flex shrink-0 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit session" onClick={() => setEditing(s)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete session" onClick={() => remove(s.id)} disabled={pending}>
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit session</DialogTitle>
          </DialogHeader>
          {editing && (
            <SessionForm
              key={editing.id}
              entries={entries}
              tz={tz}
              sessionId={editing.id}
              initial={{
                mediaItemId: editing.mediaItemId,
                mediaType: editing.mediaType,
                label: editing.label ?? "",
                startedAt: new Date(editing.startedAt),
                durationSeconds: editing.durationSeconds,
                amount: editing.amount,
                amountUnit: editing.amountUnit,
                notes: editing.notes ?? "",
              }}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
