/**
 * A tiny discriminated-union `Result` used as the return type of server actions
 * and services. Prefer returning a `Result` over throwing for *expected*
 * failures (validation, business-rule violations) so callers/UI can handle them
 * without try/catch. Reserve exceptions for programmer errors and truly
 * exceptional conditions.
 */

export type Result<T = void, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): Result<T, never>;
export function ok(): Result<void, never>;
export function ok<T>(data?: T): Result<T, never> {
  return { ok: true, data: data as T };
}

export function err<E = string>(
  error: E,
  fieldErrors?: Record<string, string[]>,
): Result<never, E> {
  return { ok: false, error, fieldErrors };
}
