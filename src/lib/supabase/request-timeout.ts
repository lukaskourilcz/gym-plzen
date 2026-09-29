export const SERVER_AUTH_TIMEOUT_MS = 8_000;

/** Bound the complete HTTP response, preserving cancellation from the caller. */
export function createTimeoutFetch(
  timeoutMs = SERVER_AUTH_TIMEOUT_MS,
  fetcher: typeof fetch = globalThis.fetch,
  /** Server/edge clients live for one request; expired refresh retries do no I/O. */
  totalDeadline = false,
): typeof fetch {
  const deadline = totalDeadline ? Date.now() + timeoutMs : null;
  return async (input, init) => {
    const remaining = deadline === null ? timeoutMs : deadline - Date.now();
    if (remaining <= 0)
      throw new DOMException("Auth request timed out", "AbortError");
    const controller = new AbortController();
    const callerSignal =
      init?.signal ?? (input instanceof Request ? input.signal : null);
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, controller.signal])
      : controller.signal;
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await fetcher(input, { ...init, signal });
      // Clearing the timer after headers alone would leave a stalled JSON
      // body unbounded. Auth responses are small; consume it under the signal.
      const body = await response.arrayBuffer();
      return new Response(body.byteLength ? body : null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } finally {
      clearTimeout(timer);
    }
  };
}

/** A refresh can back off inside the SDK; guards still return on their deadline. */
export async function verifiedAuthUser<T>(
  work: Promise<{ data: { user: T | null }; error: unknown }>,
  timeoutMs = SERVER_AUTH_TIMEOUT_MS,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work
        .then(({ data, error }) => (error ? null : data.user))
        .catch(() => null),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
