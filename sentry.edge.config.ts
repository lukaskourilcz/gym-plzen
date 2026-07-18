import * as Sentry from "@sentry/nextjs";

// Edge-runtime Sentry init (middleware, edge routes). No-op without a DSN.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
