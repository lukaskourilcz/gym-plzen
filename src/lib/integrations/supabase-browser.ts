"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";

/**
 * Browser Supabase client — used ONLY for Realtime (the live booking calendar).
 * Authentication is handled by Better Auth, not Supabase, so this client is
 * anonymous and carries only the publishable (public) key.
 *
 * Returns null when Supabase realtime isn't configured, so callers can no-op.
 */

let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !supabasePublicKey) return null;
  cached = createBrowserClient(url, supabasePublicKey);
  return cached;
}
