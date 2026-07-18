import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";

/**
 * Server-side Supabase client. We use Supabase for two things beyond the raw
 * Postgres (which Drizzle talks to directly):
 *   1. Storage — CMS media (images/files), via the secret/service-role client.
 *   2. Realtime — the live calendar subscribes from the browser (see
 *      lib/integrations/supabase-browser.ts) with the publishable key.
 *
 * Supports the new Supabase key model (`sb_secret_…` / `sb_publishable_…`) and
 * the legacy keys (`service_role` / `anon`). The secret key bypasses RLS and
 * must NEVER be exposed to the browser.
 */

let serviceClient: SupabaseClient | null = null;

/** The server-side admin key (new secret key, falling back to service role). */
function serverSecretKey(): string | null {
  return env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && serverSecretKey());
}

/** Server-only client with the secret key (full access — storage, admin). */
export function supabaseAdmin(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const key = serverSecretKey();
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). See NEEDED.md.",
    );
  }
  serviceClient = createClient(url, key, { auth: { persistSession: false } });
  return serviceClient;
}

/** Upload a file to the CMS media bucket and return its storage path. */
export async function uploadMedia(params: {
  path: string;
  body: ArrayBuffer | Buffer | Blob;
  contentType: string;
  upsert?: boolean;
}): Promise<{ path: string }> {
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const { error } = await supabaseAdmin()
    .storage.from(bucket)
    .upload(params.path, params.body, {
      contentType: params.contentType,
      upsert: params.upsert ?? false,
    });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  return { path: params.path };
}

/** Public URL for a stored media object (bucket must be public, or sign it). */
export function publicMediaUrl(storagePath: string): string {
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  return supabaseAdmin().storage.from(bucket).getPublicUrl(storagePath).data
    .publicUrl;
}

/** True when the browser has what it needs for realtime (URL + public key). */
export function isSupabaseRealtimeConfigured(): boolean {
  return Boolean(publicEnv.NEXT_PUBLIC_SUPABASE_URL && supabasePublicKey);
}
