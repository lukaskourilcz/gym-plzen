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

import { isFailedKeypadUse, keypadFailureReason } from "../../src/lib/helpers/nuki-usage";
test("failed PIN attempts retain anonymous errors but exclude other input methods", () => {
  assert.equal(isFailedKeypadUse({ ...event, state: 224, trigger: 253, authId: undefined }), true);
  assert.equal(isFailedKeypadUse({ ...event, state: 9 }), true);
  assert.equal(isFailedKeypadUse({ ...event, state: 1 }), true);
  for (const override of [{ state: 0 }, { state: undefined }, { state: 225 }, { state: 226 }, { state: 9, source: 2 }, { state: 9, source: 3 }, { state: 9, trigger: 5 }, { state: 1, action: 2 }, { state: 9, date: "invalid" }]) {
    assert.equal(isFailedKeypadUse({ ...event, ...override }), false);
  }
  assert.equal(keypadFailureReason(224), "Nesprávný vstupní kód");
  assert.equal(keypadFailureReason(9), "Přístup odmítnut");
});
