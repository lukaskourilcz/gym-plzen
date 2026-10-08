import { isTransportError } from "./browser-errors";

export function reportTransportError(error: unknown, operation: string) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs")
    .then(({ captureException }) =>
      captureException(error, {
        level: isTransportError(error) ? "warning" : "error",
        tags: {
          operation,
          recovery: "shown",
          online: String(navigator.onLine),
        },
      }),
    )
    .catch(() => {});
}
