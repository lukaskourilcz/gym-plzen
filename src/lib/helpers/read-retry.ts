import { pgErrorCode } from "./pg-error";

/** Only for reads: a lost response to a write may hide a successful commit. */
export async function retryRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const code = pgErrorCode(error);
    if (code !== "57014" && code !== "55P03" && !code?.startsWith("08"))
      throw error;
    // One fresh transaction after a short pause, never an unbounded retry loop.
    await new Promise((resolve) => setTimeout(resolve, 150));
    return read();
  }
}
