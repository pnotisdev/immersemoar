import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import type { User } from "@/lib/auth";

/**
 * Comma-separated emails that are always treated as admin, regardless of the
 * `role` column. Exists purely to bootstrap the very first admin: nobody can
 * have `role = "admin"` yet, and there's no UI to grant it without one. Once
 * an account is a real DB-backed admin, it can promote others from /admin and
 * this env var becomes unnecessary (but is harmless to leave set).
 */
function bootstrapAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user: Pick<User, "role" | "email">): boolean {
  if (user.role?.split(",").includes("admin")) return true;
  return bootstrapAdminEmails().includes(user.email.toLowerCase());
}

/** For server components on /admin/* routes. 404s (not redirects) for non-admins so the route's existence isn't leaked. */
export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return user;
}
