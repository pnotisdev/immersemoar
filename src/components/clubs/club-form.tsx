"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { createClub, updateClub, type ClubInput } from "@/actions/clubs";
import { CLUB_TAGS, type ClubTag, type ClubVisibility } from "@/db/schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ClubForm({ clubId, initial, onDone }: { clubId?: string; initial?: Partial<ClubInput>; onDone?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visibility, setVisibility] = useState<ClubVisibility>(initial?.visibility ?? "public");
  const [tags, setTags] = useState<ClubTag[]>((initial?.tags as ClubTag[]) ?? []);

  function toggleTag(t: ClubTag) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= 6 ? prev : [...prev, t]));
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload: ClubInput = {
      name: String(f.get("name") ?? ""),
      description: String(f.get("description") ?? ""),
      coverUrl: String(f.get("coverUrl") ?? ""),
      visibility,
      tags,
    };
    startTransition(async () => {
      const res = clubId ? await updateClub(clubId, payload) : await createClub(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(clubId ? "Club updated" : "Club created");
      onDone?.();
      if (!clubId && "data" in res && res.data) router.push(`/clubs/${res.data.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="c-name">Name</Label>
        <Input id="c-name" name="name" required minLength={2} maxLength={80} defaultValue={initial?.name ?? ""} placeholder="VN Reading Circle" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-desc">Description</Label>
        <Textarea id="c-desc" name="description" rows={3} maxLength={1000} defaultValue={initial?.description ?? ""} placeholder="Who is this for, what do you read/watch, how competitive is it?" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-cover">Cover image URL (optional)</Label>
        <Input id="c-cover" name="coverUrl" type="url" defaultValue={initial?.coverUrl ?? ""} placeholder="https://…" />
      </div>

      <div className="grid gap-1.5">
        <Label>Visibility</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["public", "private"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={cn("rounded-lg border p-3 text-left text-sm", visibility === v ? "border-foreground bg-muted" : "hover:bg-muted/50")}
            >
              <div className="font-medium capitalize">{v}</div>
              <div className="text-xs text-muted-foreground">{v === "public" ? "Listed in Clubs; anyone can join." : "Hidden; members join with a code."}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label>Tags (up to 6)</Label>
        <div className="flex flex-wrap gap-1.5">
          {CLUB_TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs", tags.includes(t) ? "bg-foreground text-background" : "hover:bg-muted")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onDone && (
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : clubId ? "Save changes" : "Create club"}
        </Button>
      </div>
    </form>
  );
}
