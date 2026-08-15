import assert from "node:assert/strict";
import test from "node:test";
import { parseConsentPreferences } from "../../src/lib/config/analytics";

test("tracking preferences require both explicit boolean categories", () => {
  assert.deepEqual(
    parseConsentPreferences('{"analytics":true,"marketing":false}'),
    { analytics: true, marketing: false },
  );
  assert.equal(parseConsentPreferences("granted"), null);
  assert.equal(parseConsentPreferences('{"analytics":true}'), null);
  assert.equal(parseConsentPreferences("not-json"), null);
});
