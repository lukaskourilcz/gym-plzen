import { test } from "node:test";
import assert from "node:assert/strict";
import { isSuccessfulKeypadUse } from "../../src/lib/helpers/nuki-usage";
const event = { id: "log", authId: "auth", state: 0, trigger: 255, action: 3, date: "2026-09-20T10:45:00Z" };
test("keypad opening succeeds, including legacy logs without source", () => {
  assert.equal(isSuccessfulKeypadUse(event), true);
  assert.equal(isSuccessfulKeypadUse({ ...event, source: 1 }), true);
});
test("failed, fingerprint, app, sensor and unidentified events are not PIN usage", () => {
  for (const override of [{ state: 9 }, { state: 224 }, { state: undefined }, { source: 2 }, { trigger: 5 }, { trigger: 253 }, { action: 240 }, { action: 2 }, { authId: undefined }, { date: "invalid" }]) {
    assert.equal(isSuccessfulKeypadUse({ ...event, ...override }), false);
  }
});
