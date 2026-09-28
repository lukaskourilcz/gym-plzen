import assert from "node:assert/strict";
import test from "node:test";
import { withTimeout } from "../../src/lib/supabase/middleware";

test("a stalled Auth refresh is abandoned instead of hanging the request", async () => {
  const started = Date.now();
  const outcome = await withTimeout(new Promise(() => {}), 50);
  assert.equal(outcome, "timeout");
  assert.ok(Date.now() - started < 1_000);
});

test("a prompt refresh completes, and a failing one never throws", async () => {
  assert.equal(
    await withTimeout(Promise.resolve({ data: null }), 1_000),
    "done",
  );
  assert.equal(
    await withTimeout(Promise.reject(new Error("auth down")), 1_000),
    "done",
  );
});
