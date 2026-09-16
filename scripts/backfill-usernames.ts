/**
 * One-off data migration: assigns a `username` to every existing user row that doesn't
 * have one yet (the column is nullable specifically for this — see
 * src/db/schema/auth.ts). Safe to re-run: rows that already have a username are left
 * untouched, and freshly-generated ones are checked against every username already in
 * use (including ones this same run just assigned) before being written.
 *
 * New signups never need this — src/lib/auth.ts assigns a username automatically at
 * account creation. This script only exists for accounts created before that shipped.
 *
 *   pnpm backfill:usernames
 *
 * Run this once per database, any time after the `username` column migration
 * (drizzle/0004_*.sql or later — check `pnpm db:generate`'s output) has been applied
 * with `pnpm db:migrate`. Uses the same `--conditions=react-server` invocation as
 * `pnpm seed:demo` (see scripts/seed-demo.ts) for consistency, though this script's own
 * imports don't currently need it.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { user } from "../src/db/schema";
import { dedupeUsername, slugifyUsername } from "../src/lib/username";

// Must match scripts/seed-demo.ts's DEMO_DOMAIN. Not imported from there directly:
// that file's module-scope `main().catch(...)` call would run the whole demo seed as a
// side effect of importing it.
const DEMO_DOMAIN = "@demo.immersemoar.app";

async function main() {
  const pending = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(isNull(user.username));

  if (pending.length === 0) {
    console.log("Every user already has a username. Nothing to do.");
    process.exit(0);
  }

  const takenRows = await db.select({ username: user.username }).from(user);
  const taken = new Set(takenRows.map((r) => r.username).filter((u): u is string => u != null));

  console.log(`Assigning usernames to ${pending.length} user(s)…`);
  let count = 0;
  for (const row of pending) {
    const isDemoAccount = row.email.toLowerCase().endsWith(DEMO_DOMAIN);
    const localPart = row.email.split("@")[0] ?? "";
    const base = isDemoAccount
      ? slugifyUsername(localPart) || "member"
      : slugifyUsername(row.name) || slugifyUsername(localPart) || "user";
    const chosen = dedupeUsername(base, taken);
    taken.add(chosen);

    await db.update(user).set({ username: chosen }).where(eq(user.id, row.id));
    console.log(`  ${row.email} -> ${chosen}${isDemoAccount ? " (demo)" : ""}`);
    count++;
  }

  console.log(`\nDone. Assigned ${count} username(s).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
