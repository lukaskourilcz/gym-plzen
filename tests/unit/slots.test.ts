import assert from "node:assert/strict";
import test from "node:test";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";
import {
  buildDaySlots,
  isWithinBookingHorizon,
  resolveSlotFromHours,
} from "../../src/lib/services/slots";
import {
  clampBookingHorizonDays,
  DEFAULT_BOOKING_HORIZON_DAYS,
  MAX_BOOKING_HORIZON_DAYS,
  MIN_BOOKING_HORIZON_DAYS,
} from "../../src/lib/config/schedule";

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

test("the booking horizon is configurable within a safe range", () => {
  // Everyday operation.
  assert.equal(DEFAULT_BOOKING_HORIZON_DAYS, 60);
  assert.equal(clampBookingHorizonDays(130), 130);
  // Out-of-range or nonsense values fall back rather than opening the calendar
  // indefinitely or closing it entirely.
  assert.equal(clampBookingHorizonDays(1), MIN_BOOKING_HORIZON_DAYS);
  assert.equal(clampBookingHorizonDays(10_000), MAX_BOOKING_HORIZON_DAYS);
  assert.equal(
    clampBookingHorizonDays(Number.NaN),
    DEFAULT_BOOKING_HORIZON_DAYS,
  );
  assert.equal(clampBookingHorizonDays(129.6), 130);
});

test("the horizon decides how far ahead a date may be booked", () => {
  const now = new Date("2026-10-01T09:00:00.000Z");

  // With the default 60 days, a January slot is out of reach.
  assert.equal(isWithinBookingHorizon("2027-01-20", now), false);
  // With 130 days it is bookable, which is what the October promotion needs.
  assert.equal(isWithinBookingHorizon("2027-01-20", now, 130), true);
  // Past dates never are, whatever the horizon.
  assert.equal(isWithinBookingHorizon("2026-09-30", now, 365), false);
  // The last day inside the window is included.
  assert.equal(isWithinBookingHorizon("2026-11-30", now, 60), true);
  assert.equal(isWithinBookingHorizon("2026-12-01", now, 60), false);
});
