import { env } from "@/lib/env";

/**
 * Build the Better Auth `socialProviders` map from whichever OAuth credentials
 * are configured. Providers with missing keys are simply omitted, so the app
 * boots with email/password only until you fill in the client id/secret pairs
 * (see NEEDED.md).
 */
export function buildSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> =
    {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    providers.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
    };
  }

  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
    providers.microsoft = {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
    };
  }

  return providers;
}

/** Names of the OAuth providers currently enabled — handy for rendering login buttons. */
export function enabledSocialProviderIds(): string[] {
  return Object.keys(buildSocialProviders());
}
