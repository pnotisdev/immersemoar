"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Set by Better Auth's own redirect after it validates the emailed token
  // (see requestPasswordResetCallback) — an expired/invalid token never
  // reaches this page with a token at all.
  const token = params.get("token");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setPending(true);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "That link is invalid or has expired");
      return;
    }
    toast.success("Password updated — sign in with your new password");
    router.push("/login");
  }

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid or expired link</CardTitle>
          <CardDescription>Request a new password reset link and try again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/forgot-password" className="text-sm underline underline-offset-4">
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>Choose a new password for your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "…" : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
