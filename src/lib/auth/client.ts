"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { publicEnv } from "@/lib/env";

/**
 * Browser auth client. Use its hooks/methods in client components:
 *
 *   const { data: session } = authClient.useSession();
 *   await authClient.signIn.social({ provider: "google" });
 *   await authClient.signIn.email({ email, password });
 */
export const authClient = createAuthClient({
  baseURL: publicEnv.NEXT_PUBLIC_APP_URL,
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
