import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";
import { sendEmail } from "@/lib/email";

const isProduction = process.env.NODE_ENV === "production";

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
  // Must be last: makes server actions able to set cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
