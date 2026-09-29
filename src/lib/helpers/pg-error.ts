/**
 * Read Postgres error details through driver wrappers.
 *
 * drizzle-orm 0.45 rethrows every failed query as a `DrizzleQueryError` whose
 * own message is "Failed query: …" and whose `cause` is the postgres.js error
 * carrying `code` (SQLSTATE) and `constraint_name`. Checking `error.code`
 * directly therefore never matches. These helpers walk the `cause` chain so
 * callers work with both the wrapped and the bare driver error.
 */

const MAX_DEPTH = 5;

function findInChain(
  error: unknown,
  read: (candidate: Record<string, unknown>) => string | undefined,
): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    if (typeof current !== "object" || current === null) return undefined;
    const candidate = current as Record<string, unknown>;
    const value = read(candidate);
    if (value) return value;
    current = candidate.cause;
  }
  return undefined;
}

/** The SQLSTATE code (e.g. "23505", "23P01"), or undefined when absent. */
export function pgErrorCode(error: unknown): string | undefined {
  return findInChain(error, (candidate) =>
    typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)
      ? candidate.code
      : undefined,
  );
}

/** The violated constraint or index name, or undefined when absent. */
export function pgConstraint(error: unknown): string | undefined {
  return findInChain(error, (candidate) => {
    const name = candidate.constraint_name ?? candidate.constraint;
    return typeof name === "string" && name ? name : undefined;
  });
}

export const PG_UNIQUE_VIOLATION = "23505";
export const PG_EXCLUSION_VIOLATION = "23P01";
