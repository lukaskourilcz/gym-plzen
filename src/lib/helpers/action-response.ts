import type { Result } from "./result";

/** A lost response may follow a committed write. Never retry automatically. */
export async function receiveAction<T>(
  request: () => Promise<Result<T>>,
): Promise<
  { received: true; result: Result<T> } | { received: false; error: unknown }
> {
  try {
    return { received: true, result: await request() };
  } catch (error) {
    return { received: false, error };
  }
}
