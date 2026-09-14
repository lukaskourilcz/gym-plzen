import assert from "node:assert/strict";
import test from "node:test";
import { initialBookingDateKey } from "../../src/lib/config/booking-start";

test("calendar starts on opening day before launch and today afterwards", () => {
  assert.equal(
    initialBookingDateKey(new Date("2026-09-14T12:00:00Z")),
    "2026-10-01",
  );
  assert.equal(
    initialBookingDateKey(new Date("2026-09-30T21:59:59Z")),
    "2026-10-01",
  );
  assert.equal(
    initialBookingDateKey(new Date("2026-09-30T22:00:00Z")),
    "2026-10-01",
  );
  assert.equal(
    initialBookingDateKey(new Date("2026-10-01T22:00:00Z")),
    "2026-10-02",
  );
});
