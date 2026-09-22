import assert from "node:assert/strict";
import test from "node:test";
import { siteVerification } from "../../src/lib/config/site-verification";

test("no Meta domain code means no verification tag at all", () => {
  assert.equal(siteVerification(undefined), undefined);
  assert.equal(siteVerification(""), undefined);
  assert.equal(siteVerification("   "), undefined);
});

test("the Meta domain code becomes the facebook-domain-verification tag", () => {
  assert.deepEqual(siteVerification(" abc123 "), {
    other: { "facebook-domain-verification": "abc123" },
  });
});
