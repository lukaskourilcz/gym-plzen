/**
 * Small, dependency-free HTTP helper shared by every external integration
 * (Nuki, WhatsApp, GoSMS, …). Centralises: JSON encoding, timeouts, retries
 * with exponential backoff, and consistent error shaping — so integration
 * modules stay tiny and consistent.
 */

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON body — serialised automatically and given a JSON content-type. */
  json?: unknown;
  /** Raw body (takes precedence over `json`). */
  body?: BodyInit;
  /** Abort the request after this many ms (default 15000). */
  timeoutMs?: number;
  /** Retry attempts on network error / 5xx / 429 (default 0 = no retry). */
  retries?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Perform an HTTP request and return the parsed JSON body typed as `T`.
 * Throws `HttpError` on non-2xx responses (after exhausting retries).
 */
export async function httpRequest<T = unknown>(
  url: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    json,
    body,
    headers,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 0,
    ...init
  } = options;

  const finalHeaders = new Headers(headers);
  let finalBody = body;
  if (json !== undefined && finalBody === undefined) {
    finalBody = JSON.stringify(json);
    if (!finalHeaders.has("content-type")) {
      finalHeaders.set("content-type", "application/json");
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: finalHeaders,
        body: finalBody,
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorBody = await safeParse(res);
        if (attempt < retries && isRetriableStatus(res.status)) {
          lastError = new HttpError(
            `Request to ${url} failed with ${res.status}`,
            res.status,
            errorBody,
          );
          await sleep(backoffMs(attempt));
          continue;
        }
        throw new HttpError(
          `Request to ${url} failed with ${res.status}`,
          res.status,
          errorBody,
        );
      }

      return (await safeParse(res)) as T;
    } catch (err) {
      lastError = err;
      const isAbortOrNetwork = !(err instanceof HttpError);
      if (attempt < retries && isAbortOrNetwork) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Request to ${url} failed`);
}

/** Exponential backoff with jitter: 2^attempt seconds, capped, ± up to 250ms. */
function backoffMs(attempt: number): number {
  const base = Math.min(2 ** attempt * 1000, 16_000);
  return base + Math.floor(Math.random() * 250);
}

async function safeParse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}
