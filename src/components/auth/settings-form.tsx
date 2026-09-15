"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function timezoneList(): string[] {
  try {
    // Modern browsers expose the IANA list.
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

export function SettingsForm({ user }: { user: { name: string; email: string; timezone: string; publicProfile: boolean } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const zones = useMemo(() => timezoneList(), []);
  const [tz, setTz] = useState(user.timezone);
  const [publicProfile, setPublicProfile] = useState(user.publicProfile);
  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
    startTransition(async () => {
      const res = await authClient.updateUser({ name, timezone: tz, publicProfile });
      if (res.error) {
        toast.error(res.error.message ?? "Could not save");
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="s-email">Email</Label>
        <Input id="s-email" value={user.email} disabled />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-name">Name</Label>
        <Input id="s-name" name="name" defaultValue={user.name} required maxLength={80} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="s-tz">Timezone</Label>
        <Input id="s-tz" list="tz-list" value={tz} onChange={(e) => setTz(e.target.value)} required />
        <datalist id="tz-list">
          {zones.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground">
          Sessions are grouped into days using this zone.
          {browserTz && browserTz !== tz && (
            <>
              {" "}
              Your browser says{" "}
              <button type="button" className="underline underline-offset-4" onClick={() => setTz(browserTz)}>
                {browserTz}
              </button>
              .
            </>
          )}
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-lg border p-3">
        <input type="checkbox" className="mt-1 size-4 accent-[var(--viz-series)]" checked={publicProfile} onChange={(e) => setPublicProfile(e.target.checked)} />
        <span className="grid gap-0.5 text-sm">
          <span className="font-medium">Public profile</span>
          <span className="text-xs text-muted-foreground">Appear on rankings and let others open your profile page. Your email is never shown. Turn off to be fully private.</span>
        </span>
      </label>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
