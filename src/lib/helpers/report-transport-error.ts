import { isTransportError, isStaleActionError } from "./browser-errors";

export function reportTransportError(
  error: unknown,
  operation: string,
  recovery: "shown" | "nonessential" = "shown",
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs")
    .then(({ captureException }) =>
      captureException(error, {
        level:
          isTransportError(error) || isStaleActionError(error)
            ? "warning"
            : "error",
        tags: {
          operation,
          recovery,
          online: String(navigator.onLine),
          ...(error instanceof Error &&
          "digest" in error &&
          typeof error.digest === "string" &&
          /^[\w-]{1,100}$/.test(error.digest)
            ? { rsc_digest: error.digest }
            : {}),
        },
      }),
    )
    .catch(() => {});
}
