import assert from "node:assert/strict";
import test from "node:test";
import {
  getRescheduleEligibility,
  MAX_CUSTOMER_RESCHEDULES,
} from "../../src/lib/services/rescheduling";

const startsAt = new Date("2026-09-10T16:00:00.000Z");

test("confirmed reservation can be changed exactly 24 hours before start", () => {
  const result = getRescheduleEligibility(
    { status: "confirmed", startsAt },
    false,
    new Date("2026-09-09T16:00:00.000Z"),
  );
  assert.equal(result.eligible, true);
});

test("reservation cannot be changed inside the 24-hour cutoff", () => {
  const result = getRescheduleEligibility(
    { status: "confirmed", startsAt },
    false,
    new Date("2026-09-09T16:00:00.001Z"),
  );
  assert.deepEqual(result, {
    eligible: false,
    reason: "inside_cutoff",
    deadline: new Date("2026-09-09T16:00:00.000Z"),
  });
});

test("reservation cannot be changed more than once", () => {
  assert.equal(MAX_CUSTOMER_RESCHEDULES, 1);
  const result = getRescheduleEligibility(
    { status: "confirmed", startsAt },
    true,
    new Date("2026-09-01T12:00:00.000Z"),
  );
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, "already_changed");
});

test("only confirmed reservations are eligible", () => {
  const result = getRescheduleEligibility(
    { status: "pending", startsAt },
    false,
    new Date("2026-09-01T12:00:00.000Z"),
  );
  assert.equal(result.eligible, false);
  if (!result.eligible) assert.equal(result.reason, "not_confirmed");
});
