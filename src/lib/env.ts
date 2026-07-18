import { z } from "zod";

/**
 * Centralised, type-safe access to environment variables.
 *
 * Rather than reading `process.env.X` (which is `string | undefined`) all over
 * the codebase, every module imports `env` / `publicEnv` from here. Required
 * variables are validated once at startup; integration-specific variables are
 * validated lazily inside their own modules so the app can boot even when an
 * optional integration is not yet configured (see `requireEnv`).
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Core — the app cannot run without these.
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),

  // Everything below is optional at boot; the relevant integration validates
  // its own keys via `requireEnv()` the first time it is used.
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("cms-media"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

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
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("cs"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
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

/** Server-only environment. Importing this in client code will throw at build. */
export const env = parse(serverSchema, process.env);

/**
 * Public environment. `NEXT_PUBLIC_*` vars are inlined by Next.js, so they must
 * be referenced statically — hence the explicit object rather than a loop.
 */
export const publicEnv = parse(publicSchema, {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

type ServerEnv = typeof env;

/**
 * Assert that one or more optional env vars are present before using an
 * integration, and return them narrowed to `string`. Throws a clear,
 * actionable error otherwise — pointing the operator at NEEDED.md.
 *
 * @example
 *   const { STRIPE_SECRET_KEY } = requireEnv("STRIPE_SECRET_KEY");
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
