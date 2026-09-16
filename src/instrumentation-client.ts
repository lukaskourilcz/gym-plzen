/**
 * Browser-side Sentry.
 *
 * The SDK weighs ~140 KB gzipped and costs half a second of main-thread time
 * on a mid-range phone, and without a DSN it does nothing at all. It is
 * therefore fetched as a separate chunk, after hydration, and only when
 * NEXT_PUBLIC_SENTRY_DSN is set at build time; with the variable empty the
 * whole branch is dropped from the bundle.
 */
type SentryClient = typeof import("@sentry/nextjs");

let sentry: SentryClient | null = null;
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
    sentry = Sentry;
  });
}

/** Forwards navigations to the SDK once it has loaded; a no-op before that. */
export const onRouterTransitionStart: SentryClient["captureRouterTransitionStart"] =
  (...args) => {
    sentry?.captureRouterTransitionStart(...args);
  };
