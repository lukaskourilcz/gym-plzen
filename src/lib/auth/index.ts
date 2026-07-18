import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import {
  account,
  session,
  user,
  verification,
} from "@/lib/db/schema";
import { env, publicEnv } from "@/lib/env";
import { buildSocialProviders } from "./social-providers";

/**
 * Better Auth server instance — the single source of truth for authentication.
 *
 * - Drizzle adapter over Supabase Postgres (tables in ./schema/auth.ts).
 * - Email/password plus any configured OAuth providers (Google/Apple/Microsoft).
 * - The `admin` plugin adds a `role` to users; "admin" role unlocks the
 *   administration (guarded in src/lib/auth/guards.ts).
 * - `nextCookies()` must be the last plugin so Set-Cookie headers work in
 *   Next.js server actions.
 */
export const auth = betterAuth({
  appName: "Gym Plzeň",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [publicEnv.NEXT_PUBLIC_APP_URL],

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),

  emailAndPassword: {
    enabled: true,
    // Wire real verification email once Resend is configured (see NEEDED.md).
    requireEmailVerification: false,
  },

  socialProviders: buildSocialProviders(),

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "member",
        input: false, // never settable by the client
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day
  },

  plugins: [
    admin({
      defaultRole: "member",
      adminRoles: ["admin"],
    }),
    nextCookies(),
  ],
});

export type Auth = typeof auth;
export type Session = Auth["$Infer"]["Session"];
