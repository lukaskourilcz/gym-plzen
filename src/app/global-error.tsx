"use client";

import { useEffect } from "react";

/**
 * Root error boundary. Reports React render errors to Sentry and shows a
 * minimal fallback. The SDK is loaded on demand so this boundary, which is
 * part of every page's client bundle, does not carry it for visitors who
 * never hit an error (and not at all when no DSN is configured).
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    void import("@sentry/nextjs").then((Sentry) =>
      Sentry.captureException(error),
    );
  }, [error]);

  return (
    <html lang="cs">
      <body>
        <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
          <h1>Něco se pokazilo</h1>
          <p>
            Omlouváme se, došlo k neočekávané chybě. Zkuste to prosím znovu.
          </p>
        </main>
      </body>
    </html>
  );
}
