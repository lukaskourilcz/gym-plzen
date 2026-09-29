"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";
import { SUPABASE_COOKIE_OPTIONS } from "./cookie-options";

/**
 * Browser Supabase client : used for Supabase Auth (login/signup/OAuth) and
 * Realtime (the live calendar). Cached per tab. Returns null when Supabase isn't
 * configured so callers can no-op.
 */
let cached: SupabaseClient | null = null;

export function createClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !supabasePublicKey) return null;
  // The browser client also rewrites the session cookie when it refreshes the
  // token, so it carries the same attributes as the server-side clients.
  cached = createBrowserClient(url, supabasePublicKey, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
  });
  return cached;
}
