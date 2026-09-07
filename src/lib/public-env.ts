import { z } from "zod";

/**
 * Client-safe public environment. Only `NEXT_PUBLIC_*` variables live here, and
 * this module NEVER touches server-only variables : so it is safe to import from
 * client components. (The server env in `./env.ts` validates secrets at import
 * time, which must not run in the browser.)
 *
 * `NEXT_PUBLIC_*` vars are inlined by Next.js, so they must be referenced
 * statically : hence the explicit object rather than a loop over `process.env`.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("cs"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  // New Supabase key model: `sb_publishable_…` (replaces the legacy anon key).
  // Both are accepted; the publishable key wins when present.
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_OAUTH_PROVIDERS: z.string().optional(),
  /*
   * Measurement IDs. Unset means the corresponding script is never loaded and
   * its consent category is not offered, which is the correct state for a
   * deployment that has no analytics account yet.
   */
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
  NEXT_PUBLIC_META_PIXEL_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

function parsePublic() {
  const source = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_OAUTH_PROVIDERS: process.env.NEXT_PUBLIC_OAUTH_PROVIDERS,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_META_PIXEL_ID: process.env.NEXT_PUBLIC_META_PIXEL_ID,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  };
  const result = publicSchema.safeParse(
    Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        value?.trim() || undefined,
      ]),
    ),
  );
  if (!result.success) {
    throw new Error(
      `Invalid public environment: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  return result.data;
}

export const publicEnv = parsePublic();

/** The browser-safe Supabase key (new publishable key, falling back to anon). */
export const supabasePublicKey =
  publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  null;
