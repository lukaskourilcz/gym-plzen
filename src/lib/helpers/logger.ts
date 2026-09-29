import * as SentryModule from "@sentry/nextjs";

type Meta = Record<string, unknown>;

type SentryApi = Pick<
  typeof SentryModule,
  "addBreadcrumb" | "captureException" | "captureMessage"
>;

/*
 * Inside the Next.js runtime the SDK's named exports are right here. A plain
 * Node process (a CLI script, the test runner) can resolve the package to its
 * CommonJS build instead, where they sit behind `default`; and a warning
 * written on the way to a database error must never itself crash a script.
 */
function sentry(): SentryApi | null {
  const candidates: unknown[] = [
    SentryModule,
    (SentryModule as { default?: unknown }).default,
  ];
  for (const candidate of candidates) {
    if (
      candidate &&
      typeof (candidate as SentryApi).addBreadcrumb === "function" &&
      typeof (candidate as SentryApi).captureException === "function"
    )
      return candidate as SentryApi;
  }
  return null;
}
const sensitiveKey =
  /(password|secret|token|authorization|cookie|code|pin|email|phone|payload|body|from)/i;

export function redactForLogs(value: string): string {
  return (
    value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
      .replace(/\+\d(?:[\s().-]?\d){7,14}(?!\d)/g, "[redacted-phone]")
      .replace(/(?<!\d)(?:\d{3}[ .]?){2}\d{3}(?!\d)/g, "[redacted-phone]")
      // Query/HTTP errors may echo an email body or a Nuki request parameter.
      .replace(
        /(?<![A-Za-z0-9])\d{3}[ .-]?\d{3}(?![A-Za-z0-9])/g,
        "[redacted-pin]",
      )
      .replace(
        /\b(?:eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+\b/g,
        "[redacted-token]",
      )
      .slice(0, 500)
  );
}

function sanitize(value: unknown, key = "", depth = 0): unknown {
  if (sensitiveKey.test(key)) return "[redacted]";
  if (depth > 3) return "[truncated]";
  if (typeof value === "string") return redactForLogs(value);
  if (value instanceof Error) return redactForLogs(value.message);
  if (Array.isArray(value))
    return value.slice(0, 20).map((item) => sanitize(item, key, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([entryKey, entryValue]) => [
          entryKey,
          sanitize(entryValue, entryKey, depth + 1),
        ]),
    );
  }
  return value;
}

function cleanMeta(meta?: Meta): Meta | undefined {
  return meta ? (sanitize(meta) as Meta) : undefined;
}

function line(level: string, message: string, meta?: Meta): void {
  const clean = cleanMeta(meta);
  const suffix = clean ? ` ${JSON.stringify(clean)}` : "";
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    `[${level}] ${redactForLogs(message)}${suffix}`,
  );
}

export const logger = {
  debug(message: string, meta?: Meta): void {
    if (process.env.NODE_ENV !== "production") line("debug", message, meta);
  },
  info(message: string, meta?: Meta): void {
    line("info", message, meta);
  },
  warn(message: string, meta?: Meta): void {
    const clean = cleanMeta(meta);
    line("warn", message, clean);
    // Warnings are context for the next error, not events of their own:
    // routine conditions ("duplicate alert suppressed", a default used while
    // the database is unreachable) must not each open a Sentry issue.
    sentry()?.addBreadcrumb({
      level: "warning",
      message: redactForLogs(message),
      data: clean,
    });
  },
  error(error: unknown, meta?: Meta): void {
    const message = redactForLogs(
      error instanceof Error ? error.message : String(error),
    );
    const clean = cleanMeta(meta);
    line("error", message, clean);
    if (error instanceof Error) {
      // Keep the stack and the error class so Sentry can group the failure,
      // but never the unredacted message.
      sentry()?.captureException(scrubError(error, message), { extra: clean });
      return;
    }
    sentry()?.captureMessage(message, { level: "error", extra: clean });
  },
};

/** A copy of the error with the redacted message and the original stack. */
export function scrubError(error: Error, redactedMessage: string): Error {
  const scrubbed = new Error(redactedMessage);
  scrubbed.name = error.name;
  scrubbed.stack = error.stack
    ? error.stack.replace(error.message, redactedMessage)
    : scrubbed.stack;
  return scrubbed;
}
