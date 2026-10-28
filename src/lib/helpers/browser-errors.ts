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

/** Known Google Maps runtime failures; a matching Maps stack is mandatory. */
export function isGoogleMapsModuleError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (/^Could not load "[a-z0-9_]+"\.$/i.test(error.message) ||
      /^~#!#~[0-3]~#!#~(?:Script error\.|EpochMismatch,\d+,\s*\d+|CompileError: call to WebAssembly\.instantiate\(\) blocked by CSP)~#!#~$/.test(
        error.message,
      ) ||
      (error instanceof TypeError &&
        error.message ===
          "undefined is not an object (evaluating 'a.getRootNode')")) &&
    /(?:maps\.googleapis\.com|maps-api-v3)\//.test(error.stack ?? "")
  );
}

/** Inline scripts injected by a native browser, never our bundled application. */
function isInlinePageFrame(filename: string) {
  return /^(?:app:\/\/\/|https:\/\/(?:www\.)?navigym\.cz\/)[^?#.]*$/.test(
    filename,
  );
}

/** Exact native signatures confirmed in Sentry, with browser and stack evidence. */
export function isInjectedBrowserError(
  event: ErrorEvent,
  userAgent: string,
): boolean {
  const facebook = /FBAN|FBAV|\bFacebook\b/.test(userAgent);
  const instagram = /\bInstagram\b/.test(userAgent);
  if (!facebook && !instagram) return false;
  const exceptions = event.exception?.values ?? [];
  return (
    exceptions.length === 1 &&
    exceptions.every((exception) => {
      const frames = exception.stacktrace?.frames ?? [];
      if (frames.length === 0) return false;
      const value = exception.value ?? "";
      if (
        facebook &&
        exception.type === "Error" &&
        value === "Error invoking postMessage: Java object is gone"
      ) {
        return frames.every((frame) =>
          /^(?:app:\/\/|https:\/\/www\.navigym\.cz\/)navigation_performance_logger_android$/.test(
            frame.filename ?? "",
          ),
        );
      }
      if (!frames.every((frame) => isInlinePageFrame(frame.filename ?? "")))
        return false;
      if (
        facebook &&
        exception.type === "InvalidAccessError" &&
        value === "The object does not support the operation or argument."
      ) {
        // Other DOM InvalidAccessErrors remain application errors. These two
        // functions identify Facebook's injected submit-button instrumentation.
        return ["dispatchToBridge", "logSubmitButtonClicked"].every((name) =>
          frames.some((frame) => frame.function === name),
        );
      }
      if (exception.type !== "TypeError") return false;
      return (
        (facebook &&
          [
            "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
            "null is not an object (evaluating 'e.contentWindow.postMessage')",
          ].includes(value)) ||
        (instagram &&
          value ===
            "undefined is not an object (evaluating 'window._META.IABInnerFrame')")
      );
    })
  );
}

/** Compatibility for existing callers; Instagram is deliberately excluded. */
export function isInjectedFacebookError(event: ErrorEvent, userAgent: string) {
  return (
    /FBAN|FBAV|\bFacebook\b/.test(userAgent) &&
    isInjectedBrowserError(event, userAgent)
  );
}
