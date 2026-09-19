import assert from "node:assert/strict";
import test from "node:test";
import { receiveAction } from "../../src/lib/helpers/action-response";
import { err, ok } from "../../src/lib/helpers/result";

test("a lost response after a write never automatically repeats the write", async () => {
  let writes = 0;
  const failure = new TypeError("Load failed");
  const response = await receiveAction(async () => {
    writes++;
    throw failure;
  });
  assert.deepEqual(response, { received: false, error: failure });
  assert.equal(writes, 1);
});

test("business rejections remain distinct from interrupted requests", async () => {
  const result = err("Tento termín je již rezervovaný.");
  assert.deepEqual(await receiveAction(async () => result), {
    received: true,
    result,
  });
});

test("an explicit retry can receive checkout after a failure", async () => {
  const checkout = ok({
    reservationId: "existing",
    url: "https://example.test/pay",
  });
  let attempts = 0;
  const request = async () => {
    if (++attempts === 1) throw new TypeError("Load failed");
    return checkout;
  };
  assert.equal((await receiveAction(request)).received, false);
  assert.deepEqual(await receiveAction(request), {
    received: true,
    result: checkout,
  });
  assert.equal(attempts, 2);
});
