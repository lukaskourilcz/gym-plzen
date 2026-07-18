import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, publicEnv, requireEnv } from "@/lib/env";

/**
 * Supabase clients. We use Supabase for two things beyond the raw Postgres
 * (which Drizzle talks to directly):
 *   1. Storage — CMS media (images/files), via the service-role client server-side.
 *   2. Realtime — the live calendar subscribes from the browser with the anon key.
 *
 * The service-role key bypasses RLS and must NEVER be exposed to the browser.
 */

let serviceClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/** Server-only client with the service-role key (full access — storage, admin). */
export function supabaseAdmin(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const { SUPABASE_SERVICE_ROLE_KEY } = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL. See NEEDED.md.");
  }
  serviceClient = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
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
