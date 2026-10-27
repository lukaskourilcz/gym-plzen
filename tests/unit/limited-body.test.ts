import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readBodyBytes,
  BodyReadError,
} from "../../src/lib/helpers/limited-body";
test("streamed bodies enforce byte bounds without trusting headers and cancel overflow", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(c) {
      c.enqueue(new Uint8Array(8));
      c.enqueue(new Uint8Array(8));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBodyBytes(
      { body, headers: new Headers({ "content-length": "1" }) },
      10,
    ),
    (e) => e instanceof BodyReadError && e.reason === "too_large",
  );
  assert.equal(cancelled, true);
});
test("small bodies preserve UTF-8 bytes and an absent body is empty", async () => {
  const expected = "Příliš žluťoučký kůň";
  assert.equal(
    (await readBodyBytes(new Response(expected), 100)).toString("utf8"),
    expected,
  );
  assert.equal((await readBodyBytes(new Response(null), 100)).length, 0);
});
test("stalled bodies have a bounded deadline and cancel the pending read", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBodyBytes({ body, headers: new Headers() }, 10, 10),
    (e) => e instanceof BodyReadError && e.reason === "timeout",
  );
  assert.equal(cancelled, true);
});
test("declared oversized bodies are rejected before reading chunks", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBodyBytes(
      { body, headers: new Headers({ "content-length": "1000" }) },
      10,
    ),
    (e) => e instanceof BodyReadError && e.reason === "too_large",
  );
  assert.equal(cancelled, true);
});
