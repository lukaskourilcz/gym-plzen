import assert from "node:assert/strict";
import { test } from "node:test";
import { createRateLimiter } from "../../src/lib/security/rate-limit";

test("a full limiter retains active blocks and refuses new identities", () => {
  const take = createRateLimiter({ maxRecords: 2, now: () => 0 });
  const rules = { limit: 1, windowMs: 1000 };
  assert.equal(take("login", "a", rules), true);
  assert.equal(take("login", "b", rules), true);
  for (let i = 0; i < 100; i++) {
    assert.equal(take("login", `new-${i}`, rules), false);
    assert.equal(take("login", "a", rules), false);
  }
});

test("expired identities release capacity without resetting another live window", () => {
  let now = 0;
  const take = createRateLimiter({ maxRecords: 2, now: () => now });
  assert.equal(take("login", "short", { limit: 1, windowMs: 10 }), true);
  assert.equal(take("booking", "long", { limit: 1, windowMs: 100 }), true);
  now = 10;
  assert.equal(take("login", "new", { limit: 1, windowMs: 20 }), true);
  assert.equal(take("booking", "long", { limit: 1, windowMs: 100 }), false);
  now = 100;
  assert.equal(take("booking", "long", { limit: 1, windowMs: 100 }), true);
});

test("scope isolates allowances and capacity does not stop an existing allowance", () => {
  const take = createRateLimiter({ maxRecords: 2, now: () => 0 });
  const rules = { limit: 2, windowMs: 100 };
  assert.equal(take("login", "a", rules), true);
  assert.equal(take("booking", "a", rules), true);
  assert.equal(take("login", "a", rules), true);
  assert.equal(take("login", "a", rules), false);
  assert.equal(take("booking", "a", rules), true);
});
