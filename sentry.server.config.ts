import * as Sentry from "@sentry/nextjs";

// Server-side Sentry init. No-op unless SENTRY_DSN is set, so it is safe to
// leave enabled in every environment (see NEEDED.md for setup).
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
