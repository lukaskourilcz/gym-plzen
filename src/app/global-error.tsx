"use client";

import { LoadError } from "@/components/site/load-error";

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
  return (
    <html lang="cs">
      <body>
        <LoadError error={error} />
      </body>
    </html>
  );
}
