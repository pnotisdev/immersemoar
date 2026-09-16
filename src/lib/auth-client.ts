"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields, usernameClient } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  // displayUsername: false must mirror the server's `username({ displayUsername: false })`
  // (src/lib/auth.ts) so the inferred user/session types line up.
  plugins: [inferAdditionalFields<typeof auth>(), usernameClient({ displayUsername: false })],
});
