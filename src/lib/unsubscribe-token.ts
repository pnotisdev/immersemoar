import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless, no-login unsubscribe tokens: `<userId>.<hmac>`, where the HMAC is over the
 * userId using BETTER_AUTH_SECRET (already required for the app to run at all, so this
 * adds no new secret to manage). Verifying just means recomputing the HMAC — nothing to
 * store, nothing that expires, and a token for one user can't be edited into a token for
 * another without knowing the secret. The "unsubscribe:" prefix domain-separates this
 * from any other HMAC use of the same secret elsewhere.
 */
function sign(userId: string): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHmac("sha256", secret).update(`unsubscribe:${userId}`).digest("hex");
}

export function createUnsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Returns the userId a valid token was issued for, or null if the token is missing/malformed/forged. */
export function verifyUnsubscribeToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const userId = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(userId);

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  // timingSafeEqual throws on mismatched lengths, so check that first — still safe since
  // both branches return the same "no" without leaking anything through timing.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}
