import assert from "node:assert/strict";
import test from "node:test";
import { pendingHoldCutoff } from "../../src/lib/services/reservations";

test("abandoned checkout hold expires after the configured window", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  assert.equal(
    pendingHoldCutoff(now).toISOString(),
    "2026-07-22T11:28:00.000Z",
  );
  assert.equal(
    pendingHoldCutoff(now, 45).toISOString(),
    "2026-07-22T11:15:00.000Z",
  );
});
