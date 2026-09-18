import assert from "node:assert/strict";
import test from "node:test";
import {
  firstBookableDateKey,
  firstBookableMonthKey,
} from "../../src/lib/config/booking-start";

test("the first bookable day is opening day before launch and today afterwards", () => {
  assert.equal(
    firstBookableDateKey(new Date("2026-09-14T12:00:00Z")),
    "2026-10-01",
  );
  assert.equal(
    firstBookableDateKey(new Date("2026-09-30T21:59:59Z")),
    "2026-10-01",
  );
  assert.equal(
    firstBookableDateKey(new Date("2026-09-30T22:00:00Z")),
    "2026-10-01",
  );
  assert.equal(
    firstBookableDateKey(new Date("2026-10-01T22:00:00Z")),
    "2026-10-02",
  );
});

test("no calendar can be paged back to a month before opening", () => {
  // The month floor is what keeps September out of the public calendar and out
  // of the reschedule calendar in the customer's profile.
  assert.equal(
    firstBookableMonthKey(new Date("2026-09-18T07:00:00Z")),
    "2026-10",
  );
  assert.equal(
    firstBookableMonthKey(new Date("2026-09-01T07:00:00Z")),
    "2026-10",
  );
  assert.equal(
    firstBookableMonthKey(new Date("2026-10-20T07:00:00Z")),
    "2026-10",
  );
  assert.equal(
    firstBookableMonthKey(new Date("2026-11-03T07:00:00Z")),
    "2026-11",
  );
});
