/** Bound streamed bytes even when Content-Length is absent or dishonest. */
export class BodyReadError extends Error {
  constructor(readonly reason: "too_large" | "timeout") {
    super(reason);
    this.name = "BodyReadError";
  }
}
export async function readBodyBytes(
  source: Pick<Response, "body" | "headers">,
  limit: number,
  timeoutMs = 5000,
): Promise<Buffer> {
  if (Number(source.headers.get("content-length")) > limit) {
    await source.body?.cancel();
    throw new BodyReadError("too_large");
  }
  const reader = source.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, timeoutMs);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) throw new BodyReadError("timeout");
      if (done) return Buffer.concat(chunks, size);
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BodyReadError("too_large");
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}
