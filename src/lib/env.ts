import { z } from "zod";

/**
 * Centralised, type-safe access to SERVER environment variables.
 *
 * IMPORTANT: this module validates server-only secrets at import time, so it
 * must never be imported from a client component (it would throw in the browser
 * where those vars are absent). Client code imports `publicEnv` from
 * `@/lib/public-env` instead; it is re-exported here only for server convenience.
 */

export { publicEnv } from "./public-env";

const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),

  // Optional during the build so the public site can deploy in demo mode.
  // Database-backed operations still require a real URL at runtime.
  DATABASE_URL: z.string().url().optional(),

  // Everything below is optional at boot; the relevant integration validates
  // its own keys via `requireEnv()` the first time it is used.
  DIRECT_URL: z.string().url().optional(),
  // New Supabase key model: `sb_secret_…` (replaces the legacy service_role key).
  // Either is accepted; the secret key wins when present.
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("cms-media"),
  // @supabase/server reads these aliases directly for API/Edge handlers.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  // Server-only Personal Access Token used solely to keep the hosted Supabase
  // Auth e-mail templates in sync with the admin editor. Never expose it.
  SUPABASE_MANAGEMENT_API_TOKEN: z.string().optional(),

  COMGATE_MERCHANT_ID: z.string().optional(),
  COMGATE_SECRET: z.string().optional(),
  COMGATE_TEST_MODE: z.enum(["true", "false"]).default("true"),

  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),

  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),

  NUKI_API_TOKEN: z.string().optional(),
  NUKI_SMARTLOCK_ID: z.string().optional(),
  NUKI_WEBHOOK_SECRET: z.string().optional(),

  GOSMS_CLIENT_ID: z.string().optional(),
  GOSMS_CLIENT_SECRET: z.string().optional(),
  GOSMS_CHANNEL: z.string().optional(),

  SENTRY_DSN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  ALERT_WHATSAPP_RECIPIENTS: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  DEMO_AUTH_ENABLED: z.enum(["true", "false"]).optional(),
  DEMO_AUTH_SECRET: z.string().min(32).optional(),
  BOOKING_PREVIEW_FIXTURE: z.enum(["true", "false"]).optional(),
  UPTIMEROBOT_HEARTBEAT_URL: z.string().url().optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, source: unknown): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

/** Server-only environment. Never import this from a client component. */
export const env = parse(serverSchema, process.env);

type ServerEnv = typeof env;

/**
 * Assert that one or more optional env vars are present before using an
 * integration, and return them narrowed to `string`. Throws a clear,
 * actionable error otherwise : pointing the operator at NEEDED.md.
 *
 * @example
 *   const { COMGATE_SECRET } = requireEnv("COMGATE_SECRET");
 */
export function requireEnv<K extends keyof ServerEnv>(
  ...keys: K[]
): { [P in K]: NonNullable<ServerEnv[P]> } {
  const missing: string[] = [];
  const out = {} as { [P in K]: NonNullable<ServerEnv[P]> };
  for (const key of keys) {
    const value = env[key];
    if (value === undefined || value === "") {
      missing.push(String(key));
    } else {
      out[key] = value as NonNullable<ServerEnv[K]>;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `See NEEDED.md for setup instructions.`,
    );
  }
  return out;
}

/** True when every provided env var is configured. Never throws. */
export function hasEnv(...keys: (keyof ServerEnv)[]): boolean {
  return keys.every((key) => {
    const value = env[key];
    return value !== undefined && value !== "";
  });
}
