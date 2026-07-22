import assert from "node:assert/strict";
import test from "node:test";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";
import {
  buildDaySlots,
  resolveSlotFromHours,
} from "../../src/lib/services/slots";

test("server resolves different configured weekday durations", () => {
  const start = localDateTimeToDate("2026-07-22", 8 * 60);
  const sixty = resolveSlotFromHours(start, {
    openMinute: 6 * 60,
    closeMinute: 22 * 60,
    slotMinutes: 60,
    isClosed: false,
  });
  const seventyFive = resolveSlotFromHours(start, {
    openMinute: 6 * 60 + 45,
    closeMinute: 22 * 60,
    slotMinutes: 75,
    isClosed: false,
  });
  assert.equal(sixty?.durationMinutes, 60);
  assert.equal(seventyFive?.endsAt.toISOString(), "2026-07-22T07:15:00.000Z");
});

test("misaligned browser-supplied start is rejected", () => {
  const start = localDateTimeToDate("2026-07-22", 8 * 60 + 10);
  assert.equal(
    resolveSlotFromHours(start, {
      openMinute: 8 * 60,
      closeMinute: 12 * 60,
      slotMinutes: 60,
      isClosed: false,
    }),
    null,
  );
});

test("past and overlapping slots are unavailable", () => {
  const now = localDateTimeToDate("2026-07-22", 9 * 60 + 30);
  const busyStart = localDateTimeToDate("2026-07-22", 10 * 60);
  const busyEnd = localDateTimeToDate("2026-07-22", 11 * 60);
  const slots = buildDaySlots(
    "2026-07-22",
    {
      openMinute: 8 * 60,
      closeMinute: 12 * 60,
      slotMinutes: 60,
      isClosed: false,
    },
    [{ start: busyStart, end: busyEnd }],
    now,
  );
  assert.deepEqual(
    slots.map((slot) => slot.available),
    [false, false, false, true],
  );
});
