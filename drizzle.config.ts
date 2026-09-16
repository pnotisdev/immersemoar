import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Schema changes now go through migrations (./drizzle), not `drizzle-kit push`.
// Workflow: edit src/db/schema/*.ts, run `pnpm db:generate` to create a new
// numbered SQL file under ./drizzle, commit it, then run `pnpm db:migrate` to
// apply it (deploys should run `pnpm db:migrate` instead of `pnpm db:push`).
//
// IMPORTANT one-time step for the existing (already-provisioned) database:
// it was built entirely via `drizzle-kit push` and never went through the
// migrations system, so it has no `drizzle.__drizzle_migrations` tracking
// table. Running `pnpm db:migrate` against it as-is fails trying to CREATE
// TABLE on tables that already exist. Baseline it first — tested against a
// local PGlite dev DB that was also push-provisioned, this exact procedure
// took it from "push-only" to "cleanly applies 0001 via db:migrate":
//
//   CREATE SCHEMA IF NOT EXISTS drizzle;
//   CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
//     id SERIAL PRIMARY KEY,
//     hash text NOT NULL,
//     created_at bigint
//   );
//   INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
//   VALUES (
//     'aa2540f3cfbca4d0237e49941c01207dc1c29b803ecd12ad1210b84daca40dec',
//     1789547300588
//   );
//
// The hash is sha256 of drizzle/0000_panoramic_turbo.sql's exact file
// contents; the created_at MUST equal that migration's own "when" value in
// drizzle/meta/_journal.json (NOT the current time) — drizzle-kit treats
// created_at as a watermark and silently skips every migration whose journal
// "when" is <= the latest applied created_at, so using "now" here would make
// it skip 0001 too. Run this once against the target database, then
// `pnpm db:migrate` will apply only 0001_tidy_donald_blake.sql (the new
// role/banned/ban_reason/ban_expires/impersonated_by/hidden columns — all
// additive with defaults, safe on a live table). Do NOT run this against a
// database that's already past 0000 in some other way without checking first.
config({ path: ".env.local" });

const url = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  ...(url
    ? { dbCredentials: { url } }
    : { driver: "pglite", dbCredentials: { url: process.env.PGLITE_PATH ?? "./.pglite" } }),
});
