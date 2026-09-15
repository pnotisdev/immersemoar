"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { joinClub, leaveClub, type ClubInput } from "@/actions/clubs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClubForm } from "./club-form";

export function CreateClubButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> Create club
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create a club</DialogTitle>
            <DialogDescription>Up to 100 members. You can change everything later.</DialogDescription>
          </DialogHeader>
          {open && <ClubForm onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditClubButton({ clubId, initial }: { clubId: string; initial: ClubInput }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit club
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit club</DialogTitle>
          </DialogHeader>
          {open && <ClubForm clubId={clubId} initial={initial} onDone={() => setOpen(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function JoinWithCodeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    startTransition(async () => {
      const res = await joinClub({ joinCode: code });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Joined!");
      setOpen(false);
      router.push(`/clubs/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <KeyRound /> Join with code
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Join a private club</DialogTitle>
            <DialogDescription>Ask the club owner for the 8-character code.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="join-code">Join code</Label>
              <Input id="join-code" name="code" required minLength={8} maxLength={8} autoCapitalize="characters" className="font-mono tracking-widest uppercase" placeholder="ABCD2345" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Joining…" : "Join"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function JoinLeaveButton({ clubId, isMember, isOwner, visibility }: { clubId: string; isMember: boolean; isOwner: boolean; visibility: "public" | "private" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (isOwner) return null;
  if (isMember) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => {
          if (!confirm("Leave this club?")) return;
          startTransition(async () => {
            const res = await leaveClub(clubId);
            if (!res.ok) toast.error(res.error);
            else {
              toast("Left the club");
              router.refresh();
            }
          });
        }}
      >
        Leave club
      </Button>
    );
  }
  if (visibility === "private") return <JoinWithCodeButton />;
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await joinClub({ clubId });
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Welcome to the club!");
            router.refresh();
          }
        })
      }
    >
      {pending ? "Joining…" : "Join club"}
    </Button>
  );
}
