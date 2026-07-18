"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Root error boundary. Reports React render errors to Sentry (no-op without a
 * DSN) and shows a minimal fallback. Replace the markup during the design phase.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="cs">
      <body>
        <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
          <h1>Něco se pokazilo</h1>
          <p>Omlouváme se, došlo k neočekávané chybě. Zkuste to prosím znovu.</p>
        </main>
      </body>
    </html>
  );
}
