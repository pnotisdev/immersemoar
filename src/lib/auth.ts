import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  user: {
    additionalFields: {
      timezone: { type: "string", required: false, defaultValue: "UTC", input: true },
      publicProfile: { type: "boolean", required: false, defaultValue: true, input: true },
    },
  },
  // Must be last: makes server actions able to set cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
