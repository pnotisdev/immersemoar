import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Better Auth core tables. JS property names must match Better Auth's field names;
// the DB column names are snake_case.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // App-specific: IANA timezone used to bucket sessions into days.
  timezone: text("timezone").notNull().default("UTC"),
  // Opt-out for leaderboards and the public profile page.
  publicProfile: boolean("public_profile").notNull().default(true),
  // Public profile handle (/u/[username]) — see the better-auth `username` plugin in
  // src/lib/auth.ts and src/lib/username.ts for the format rules (3-20 chars, lowercase
  // alphanumeric + underscore). Nullable only so existing rows can be backfilled
  // (scripts/backfill-usernames.ts); every new signup gets one automatically.
  username: text("username").unique(),
  // Opt-out for transactional-ish emails (currently just "new follower"); the actual
  // password-reset/verification emails always send regardless. See
  // src/app/api/unsubscribe/route.ts for the no-login unsubscribe link.
  emailNotifications: boolean("email_notifications").notNull().default(true),
  // Set by scripts/seed-demo.ts on demo accounts. A safety net independent of
  // `pnpm seed:demo --reset`: even if that's never run before launch, flagged users are
  // excluded from the leaderboard and the member directory's "active" sort (see
  // src/lib/ranking-queries.ts, src/lib/social-queries.ts) so they can't misrepresent
  // themselves as real top users. Everything else (profile page, feed) still works.
  isDemo: boolean("is_demo").notNull().default(false),
  // Fields for Better Auth's built-in `admin` plugin (src/lib/auth.ts). "role" is a
  // free-text string (the plugin supports comma-joined multi-role); "admin" is the
  // only role that matters here — see src/lib/admin.ts.
  role: text("role").notNull().default("user"),
  banned: boolean("banned").notNull().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Set while an admin is impersonating this session (admin plugin). Unused
    // today (we don't expose impersonation), but the plugin's schema expects it.
    impersonatedBy: text("impersonated_by"),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
