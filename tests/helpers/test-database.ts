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

export function requireTestDatabaseUrl(
  value = process.env.TEST_DATABASE_URL,
): string {
  if (!isTestDatabaseUrl(value))
    throw new Error(
      "TEST_DATABASE_URL must name a dedicated local database containing a test name segment, without query parameters. No application DATABASE_URL fallback is allowed.",
    );
  return value!;
}
