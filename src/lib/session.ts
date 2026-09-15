import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Per-request memoized session lookup. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** For server components & actions on protected routes. Redirects to /login if signed out. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
