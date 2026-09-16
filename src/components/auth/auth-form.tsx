"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/safe-redirect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  // Only ever redirect same-site: an unvalidated absolute/protocol-relative
  // `next` would let /login?next=https://evil.com be used for phishing.
  const next = safeRedirect(params.get("next"), "/dashboard");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    setPending(true);

    const result =
      mode === "signup"
        ? await authClient.signUp.email({
            email,
            password,
            name,
            // Captured once so daily stats line up with the user's actual days.
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (result.error) {
      toast.error(result.error.message ?? "Something went wrong");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "signup" ? "Create your account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {mode === "signup" ? "Start logging your immersion hours." : "Sign in to keep logging."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required minLength={1} maxLength={80} />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "login" && (
                <Link href="/forgot-password" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  Forgot password?
                </Link>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={8}
            />
          </div>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? "…" : mode === "signup" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="underline underline-offset-4">
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/signup" className="underline underline-offset-4">
                Create an account
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
