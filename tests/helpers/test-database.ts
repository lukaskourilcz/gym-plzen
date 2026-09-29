/** Destructive tests accept an explicit, dedicated local database only. */
export function isTestDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      Boolean(url.username) &&
      /(?:^|_)test(?:_|$)/.test(decodeURIComponent(url.pathname.slice(1))) &&
      // postgres.js accepts connection options in the query string, including
      // a host override. Keep the accepted connection unambiguous.
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function requireTestDatabaseUrl(value?: string): string {
  // An explicitly supplied undefined is invalid even when the process has a
  // valid test URL (as CI does). Only the zero-argument form reads the env.
  const candidate =
    arguments.length === 0 ? process.env.TEST_DATABASE_URL : value;
  if (!isTestDatabaseUrl(candidate))
    throw new Error(
      "TEST_DATABASE_URL must name a dedicated local database containing a test name segment, without query parameters. No application DATABASE_URL fallback is allowed.",
    );
  return candidate!;
}
