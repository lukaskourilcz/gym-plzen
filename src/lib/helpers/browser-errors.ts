import type { ErrorEvent } from "@sentry/nextjs";

// Drop a Maps error only after the mounted component restores its iframe.
const recoveredMapErrors = new WeakSet<object>();
export function markMapErrorRecovered(error: object) {
  recoveredMapErrors.add(error);
}
export function wasMapErrorRecovered(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && recoveredMapErrors.has(error)
  );
}

export function isTransportError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?|network error|Error in input stream)$/.test(
      error.message,
    )
  );
}

/** An internal Google Maps module failure, not an application error. */
export function isGoogleMapsModuleError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^Could not load "[a-z0-9_]+"\.$/i.test(error.message) &&
    /(?:maps\.googleapis\.com|maps-api-v3)\//.test(error.stack ?? "")
  );
}

/** Match only the two native-bridge signatures observed in Facebook's browser. */
export function isInjectedFacebookError(
  event: ErrorEvent,
  userAgent: string,
): boolean {
  if (!/FBAN|FBAV|\bFacebook\b/.test(userAgent)) return false;
  const exceptions = event.exception?.values ?? [];
  return (
    exceptions.length === 1 &&
    exceptions.every((exception) => {
      if (
        exception.type !== "TypeError" ||
        ![
          "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
          "null is not an object (evaluating 'e.contentWindow.postMessage')",
        ].includes(exception.value ?? "")
      )
        return false;
      const frames = exception.stacktrace?.frames ?? [];
      return (
        frames.length > 0 &&
        frames.every((frame) => {
          const file = frame.filename ?? "";
          return /^(?:app:\/\/\/|https:\/\/www\.navigym\.cz\/)\s*$/.test(file);
        })
      );
    })
  );
}
