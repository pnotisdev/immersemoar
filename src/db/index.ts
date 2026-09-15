import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

// Both drivers produce a PgDatabase; the shared base type keeps the query builder's
// overloads intact (a union of the two driver types would not).
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Cached on globalThis so `next dev` hot reloads don't open a new connection / PGlite instance each time.
const g = globalThis as unknown as { __immersemoarDb?: Db };

function createDb(): Db {
  const url = process.env.DATABASE_URL;
  if (url) {
    return drizzlePostgres(url, { schema });
  }
  // Embedded Postgres for local development; data lives in ./.pglite.
  // PGlite is single-process: never run `next build` or `drizzle-kit push` while `next dev` is up.
  return drizzlePglite("./.pglite", { schema });
}

function getDb(): Db {
  return g.__immersemoarDb ?? (g.__immersemoarDb = createDb());
}

// Lazy: importing this module must not open a database (e.g. during `next build` prerendering).
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
