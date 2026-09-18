import assert from "node:assert/strict";
import test from "node:test";
import { firstBookableDateKey } from "../../src/lib/config/booking-start";

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
  // Both calendars take their month from this day, and that is what keeps
  // September out of the public calendar and out of the customer's profile.
  const monthOf = (iso: string) =>
    firstBookableDateKey(new Date(iso)).slice(0, 7);
  assert.equal(monthOf("2026-09-18T07:00:00Z"), "2026-10");
  assert.equal(monthOf("2026-09-01T07:00:00Z"), "2026-10");
  assert.equal(monthOf("2026-10-20T07:00:00Z"), "2026-10");
  assert.equal(monthOf("2026-11-03T07:00:00Z"), "2026-11");
});
