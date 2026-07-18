import * as Sentry from "@sentry/nextjs";

/**
 * Thin logging facade. Wraps console + Sentry so the rest of the codebase never
 * imports Sentry directly and log calls are uniform. When Sentry is not
 * configured its SDK calls are safe no-ops.
 */

type Meta = Record<string, unknown>;

function line(level: string, message: string, meta?: Meta): void {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
  console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](
    `[${level}] ${message}${suffix}`,
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
    line("warn", message, meta);
    Sentry.captureMessage(message, { level: "warning", extra: meta });
  },

  /** Log an error and report it to Sentry. Accepts an Error or a message. */
  error(error: unknown, meta?: Meta): void {
    const message = error instanceof Error ? error.message : String(error);
    line("error", message, meta);
    if (error instanceof Error) {
      Sentry.captureException(error, { extra: meta });
    } else {
      Sentry.captureMessage(message, { level: "error", extra: meta });
    }
  },
};
