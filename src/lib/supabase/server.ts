import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";

/**
 * Server-side Supabase client bound to the request cookies (for Supabase Auth).
 * Returns null when Supabase isn't configured, so callers (guards, public pages)
 * treat that as "signed out" and still render.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !supabasePublicKey) return null;

  const cookieStore = await cookies();
  return createServerClient(url, supabasePublicKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component (read-only cookies) — the middleware
          // refreshes the session cookie, so this is safe to ignore.
        }
      },
    },
  });
}
