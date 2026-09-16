"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { banUserAction, setClubHidden, setSessionHidden, setUserRoleAction, unbanUserAction } from "@/actions/admin";
import type { AdminClubRow, AdminSessionNoteRow, AdminUserRow } from "@/lib/admin-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UsersTable({ users, viewerId }: { users: AdminUserRow[]; viewerId: string }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const [, startTransition] = useTransition();

  function run(id: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setPendingId(id);
    startTransition(async () => {
      const res = await fn();
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function submitBan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!banTarget) return;
    const reason = String(new FormData(e.currentTarget).get("reason") ?? "").trim();
    const id = banTarget.id;
    setBanTarget(null);
    run(id, () => banUserAction(id, reason || undefined));
  }

  return (
    <div className="grid gap-2">
      {users.map((u) => {
        const isAdminRole = u.role?.split(",").includes("admin");
        const busy = pendingId === u.id;
        return (
          <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{u.name}</span>
                {isAdminRole && <Badge variant="secondary">admin</Badge>}
                {u.banned && <Badge variant="destructive">banned</Badge>}
              </div>
              <div className="truncate text-xs text-muted-foreground">{u.email}</div>
              {u.banned && u.banReason && <div className="mt-0.5 text-xs text-muted-foreground">Reason: {u.banReason}</div>}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {u.id !== viewerId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(u.id, () => setUserRoleAction(u.id, isAdminRole ? "user" : "admin"))}
                >
                  {isAdminRole ? "Revoke admin" : "Make admin"}
                </Button>
              )}
              {u.id !== viewerId &&
                (u.banned ? (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => run(u.id, () => unbanUserAction(u.id))}>
                    Unban
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => setBanTarget(u)}>
                    Ban
                  </Button>
                ))}
            </div>
          </div>
        );
      })}
      {users.length === 0 && <p className="text-sm text-muted-foreground">No users match.</p>}

      <Dialog open={banTarget !== null} onOpenChange={(next) => !next && setBanTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban {banTarget?.name}</DialogTitle>
            <DialogDescription>
              They&apos;ll be signed out everywhere and unable to sign back in until unbanned. This does not delete their data.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitBan} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ban-reason">Reason (optional, shown to admins only)</Label>
              <Input id="ban-reason" name="reason" autoFocus />
            </div>
            <DialogFooter showCloseButton>
              <Button type="submit" variant="destructive">
                Ban user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SessionNotesList({ sessions }: { sessions: AdminSessionNoteRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string, hidden: boolean) {
    setPendingId(id);
    startTransition(async () => {
      const res = await setSessionHidden(id, hidden);
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      {sessions.map((s) => (
        <div key={s.id} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{s.userName}</span>
              <span>{new Date(s.startedAt).toLocaleString()}</span>
              {s.hidden && <Badge variant="destructive">hidden</Badge>}
            </div>
            <p className="mt-1 text-sm">{s.notes}</p>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={pendingId === s.id} onClick={() => toggle(s.id, !s.hidden)}>
            {s.hidden ? "Unhide" : "Hide"}
          </Button>
        </div>
      ))}
      {sessions.length === 0 && <p className="text-sm text-muted-foreground">No session notes yet.</p>}
    </div>
  );
}

export function ClubsList({ clubs }: { clubs: AdminClubRow[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(id: string, hidden: boolean) {
    setPendingId(id);
    startTransition(async () => {
      const res = await setClubHidden(id, hidden);
      setPendingId(null);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      {clubs.map((c) => (
        <div key={c.id} className="flex items-start gap-3 rounded-lg border p-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{c.name}</span>
              <Badge variant="outline">{c.visibility}</Badge>
              {c.hidden && <Badge variant="destructive">hidden</Badge>}
            </div>
            <div className="text-xs text-muted-foreground">Owner: {c.ownerName}</div>
            {c.description && <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>}
          </div>
          <Button type="button" variant="outline" size="sm" disabled={pendingId === c.id} onClick={() => toggle(c.id, !c.hidden)}>
            {c.hidden ? "Unhide" : "Hide"}
          </Button>
        </div>
      ))}
      {clubs.length === 0 && <p className="text-sm text-muted-foreground">No clubs yet.</p>}
    </div>
  );
}
