import assert from "node:assert/strict";
import test from "node:test";
import { retryRead } from "../../src/lib/helpers/read-retry";

test("a wrapped Postgres timeout retries once and returns the fresh result", async () => {
  let calls = 0;
  const result = await retryRead(async () => {
    if (++calls === 1)
      throw new Error("Failed query", { cause: { code: "57014" } });
    return "live";
  });
  assert.equal(result, "live");
  assert.equal(calls, 2);
});
test("persistent transient failures propagate after two attempts", async () => {
  let calls = 0;
  const error = { code: "55P03" };
  await assert.rejects(
    retryRead(async () => {
      calls++;
      throw error;
    }),
    (e) => e === error,
  );
  assert.equal(calls, 2);
});
test("permission, constraint and programming errors are never retried", async () => {
  for (const error of [
    { code: "42501" },
    { code: "23505" },
    new TypeError("bug"),
  ]) {
    let calls = 0;
    await assert.rejects(
      retryRead(async () => {
        calls++;
        throw error;
      }),
      (e) => e === error,
    );
    assert.equal(calls, 1);
  }
});
