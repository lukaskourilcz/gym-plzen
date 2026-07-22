import * as Sentry from "@sentry/nextjs";

type Meta = Record<string, unknown>;
const sensitiveKey =
  /(password|secret|token|authorization|cookie|code|pin|email|phone|payload|body|from)/i;

export function redactForLogs(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\+\d(?:[\s().-]?\d){7,14}(?!\d)/g, "[redacted-phone]")
    .replace(/(?<!\d)(?:\d{3}[ .]?){2}\d{3}(?!\d)/g, "[redacted-phone]")
    .replace(
      /\b(?:eyJ[a-zA-Z0-9_-]+\.){2}[a-zA-Z0-9_-]+\b/g,
      "[redacted-token]",
    )
    .slice(0, 500);
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
    Sentry.captureMessage(redactForLogs(message), {
      level: "warning",
      extra: clean,
    });
  },
  error(error: unknown, meta?: Meta): void {
    const message = redactForLogs(
      error instanceof Error ? error.message : String(error),
    );
    const clean = cleanMeta(meta);
    line("error", message, clean);
    Sentry.captureMessage(message, { level: "error", extra: clean });
  },
};
