import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { and, asc, eq, like, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";
import { dedupeUsername, slugifyUsername, USERNAME_MAX, USERNAME_MIN, USERNAME_RE } from "@/lib/username";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Every account needs a working /u/[username] profile URL from the moment it's created
 * — nothing in the signup form collects one (see src/components/auth/auth-form.tsx), and
 * leaving it null until the user visits Settings would break "Your profile" in the nav
 * and every profile link pointing at them. Derives a slug from the display name (falling
 * back to the email local-part for names with no Latin characters, e.g. all-Japanese),
 * then de-dupes against existing usernames with a numeric suffix. Mirrors
 * scripts/backfill-usernames.ts, which does the same for rows that predate this column.
 */
async function generateUniqueUsername(name: string, email: string): Promise<string> {
  const base = slugifyUsername(name) || slugifyUsername(email.split("@")[0] ?? "") || "user";
  // A prefix scan is enough: dedupeUsername only ever needs to know which candidates
  // derived from `base` are taken, not the full username table.
  const rows = await db
    .select({ username: schema.user.username })
    .from(schema.user)
    .where(like(schema.user.username, `${base}%`));
  const taken = new Set(rows.map((r) => r.username).filter((u): u is string => u != null));
  return dedupeUsername(base, taken);
}

/**
 * Better Auth's built-in account deletion (`user.deleteUser`) relies on Postgres
 * `ON DELETE CASCADE` FKs to wipe the user's own rows (sessions, library entries,
 * goals, kudos, club memberships, etc. — see src/db/schema/*.ts). One FK is
 * asymmetric though: `clubs.ownerId` cascades too, which would delete the whole
 * club — including *other members'* memberships/picks/votes — just because the
 * owner deleted their account. Reassign ownership to the longest-standing other
 * member first so a solo user's departure doesn't take a whole club down with it;
 * a club with no other members is still deleted via the normal cascade.
 */
async function reassignOwnedClubs(userId: string) {
  const owned = await db.query.clubs.findMany({ where: eq(schema.clubs.ownerId, userId), columns: { id: true } });
  for (const club of owned) {
    const successor = await db.query.clubMembers.findFirst({
      where: and(eq(schema.clubMembers.clubId, club.id), ne(schema.clubMembers.userId, userId)),
      orderBy: [asc(schema.clubMembers.joinedAt)],
    });
    if (!successor) continue; // No other members: let the cascade delete the club.
    await db.transaction(async (tx) => {
      await tx.update(schema.clubs).set({ ownerId: successor.userId }).where(eq(schema.clubs.id, club.id));
      await tx
        .update(schema.clubMembers)
        .set({ role: "owner" })
        .where(and(eq(schema.clubMembers.clubId, club.id), eq(schema.clubMembers.userId, successor.userId)));
    });
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Reset your immersemoar password",
        text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset the password for your immersemoar account.\n\nReset it here: ${url}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
      });
    },
    // Existing accounts predate email verification and would otherwise be
    // locked out on their next sign-in — leave sign-in unblocked for now.
    // New signups still get a verification email (see emailVerification.sendOnSignUp)
    // and this can be flipped to `true` once verification has rolled out.
    requireEmailVerification: false,
  },
  emailVerification: {
    async sendVerificationEmail({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: "Verify your immersemoar email",
        text: `Hi ${user.name},\n\nConfirm this is your email address to finish setting up your immersemoar account.\n\nVerify it here: ${url}\n\nThis link expires in 1 hour. If you didn't create this account, you can ignore this email.`,
      });
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "UTC", input: true },
      publicProfile: { type: "boolean", required: false, defaultValue: true, input: true },
      // Settable from Settings (authClient.updateUser) so a user can turn it back on;
      // the no-login unsubscribe link (src/app/api/unsubscribe/route.ts) flips it off
      // directly with a `db.update` instead, since that flow has no session at all.
      emailNotifications: { type: "boolean", required: false, defaultValue: true, input: true },
    },
    deleteUser: {
      enabled: true,
      // No sendDeleteAccountVerification: the client always sends the user's
      // current password, which lets Better Auth skip the session-freshness
      // check and delete immediately — one dialog, no extra email round trip.
      async beforeDelete(user) {
        await reassignOwnedClubs(user.id);
      },
    },
  },
  // Better Auth already reads BETTER_AUTH_URL as its own baseURL (and trusts
  // it implicitly); this is spelled out explicitly so trustedOrigins doesn't
  // silently end up empty if that inference ever changes.
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : undefined,
  rateLimit: {
    // Better Auth's built-in special rules already cap /sign-in, /sign-up,
    // /request-password-reset and /send-verification-email more tightly than
    // this; this is the fallback for every other auth endpoint.
    enabled: true,
    window: 60,
    max: 30,
  },
  advanced: {
    // Cookies must be `Secure` in production (served over HTTPS behind the
    // reverse proxy) but NOT in local dev, where the app runs on plain HTTP.
    useSecureCookies: isProduction,
    ipAddress: {
      // The app is expected to run behind a reverse proxy (e.g. nginx/Vercel)
      // that sets this header; without it, rate limiting would key off a
      // single shared bucket instead of the real client IP.
      ipAddressHeaders: ["x-forwarded-for"],
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Runs *after* the username plugin's own create hook (plugin hooks run in
        // plugins-array order, then this root-level hook — see
        // node_modules/better-auth/dist/context/helpers.mjs), so this only ever sees an
        // empty username on the normal signup path (src/components/auth/auth-form.tsx
        // doesn't collect one). scripts/seed-demo.ts passes an explicit `username` per
        // demo account, which the plugin's own hook already validated/normalized by the
        // time this runs, so it's left untouched here.
        async before(user) {
          const existing = "username" in user ? user.username : undefined;
          if (typeof existing === "string" && existing.length > 0) return;
          const generated = await generateUniqueUsername(user.name, user.email);
          return { data: { ...user, username: generated } };
        },
      },
    },
  },
  plugins: [
    // Gives us role-based admin checks plus banUser/unbanUser primitives (used by
    // /admin — see src/lib/admin.ts) instead of hand-rolling them. Banned users are
    // rejected at session-creation time by the plugin itself and their existing
    // sessions are revoked when the ban is applied.
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // Public profile handles (/u/[username]). displayUsername is disabled: the format
    // this app wants (lowercase alphanumeric + underscore) is always normalized anyway,
    // so a separate "as-typed" casing has no use here and would just be another column.
    username({
      displayUsername: false,
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      usernameValidator: (value) => USERNAME_RE.test(value),
      // Validate the lowercased form so mixed-case input (e.g. "Mika_Aoyama") is accepted
      // and simply normalized, rather than rejected for containing uppercase letters.
      validationOrder: { username: "post-normalization" },
    }),
    // Must be last: makes server actions able to set cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
