import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emailRetentionCutoff,
  isEmailRetained,
} from "../../src/lib/helpers/email-retention";

test("email retention expires at exactly 30 days, including across DST", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  const cutoff = emailRetentionCutoff(now);
  assert.equal(cutoff.toISOString(), "2026-10-02T12:00:00.000Z");
  assert.equal(isEmailRetained(cutoff, now), false);
  assert.equal(isEmailRetained(new Date(cutoff.getTime() - 1), now), false);
  assert.equal(isEmailRetained(new Date(cutoff.getTime() + 1), now), true);
  assert.equal(isEmailRetained(now, now), true);
  assert.equal(isEmailRetained(new Date(now.getTime() + 1), now), false);
  assert.equal(isEmailRetained(new Date("invalid"), now), false);
});
