import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CalendarAvailabilityCache,
  CALENDAR_CACHE_TTL,
} from "../../src/lib/helpers/calendar-cache";
import {
  calendarLocation,
  type CalendarView,
} from "../../src/lib/config/booking-calendar";
const value: CalendarView = {
  ...calendarLocation(
    { date: "2026-10-17" },
    60,
    new Date("2026-10-16T12:00:00Z"),
  ),
  days: [],
  selectedSlots: [],
  source: "live",
};
test("public calendar cache expires at fifteen seconds and excludes unavailable snapshots", () => {
  const cache = new CalendarAvailabilityCache();
  cache.seed(value, 100);
  assert.equal(
    cache.peek(
      value.monthKey,
      value.selectedDateKey,
      100 + CALENDAR_CACHE_TTL - 1,
    ),
    value,
  );
  assert.equal(
    cache.peek(value.monthKey, value.selectedDateKey, 100 + CALENDAR_CACHE_TTL),
    null,
  );
  cache.seed({ ...value, source: "unavailable" }, 20000);
  assert.equal(cache.peek(value.monthKey, value.selectedDateKey, 20000), null);
});
test("concurrent requests share one read and invalidation rejects pre-change responses", async () => {
  const cache = new CalendarAvailabilityCache();
  let calls = 0;
  let finish!: (value: CalendarView) => void;
  const fetcher = () => {
    calls++;
    return new Promise<CalendarView>((resolve) => {
      finish = resolve;
    });
  };
  const a = cache.load(value.monthKey, value.selectedDateKey, fetcher),
    b = cache.load(value.monthKey, value.selectedDateKey, fetcher);
  assert.equal(calls, 1);
  finish(value);
  assert.deepEqual(await Promise.all([a, b]), [value, value]);
  cache.invalidate();
  const old = cache.load(value.monthKey, value.selectedDateKey, fetcher);
  cache.invalidate();
  finish(value);
  await assert.rejects(old, /invalidated/);
  assert.equal(cache.peek(value.monthKey, value.selectedDateKey), null);
});
test("calendar location clamps month and date to current server horizon", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.equal(
    calendarLocation({ date: "2026-10-32", month: "2026-13" }, 60, now)
      .selectedDateKey,
    "2026-10-16",
  );
  assert.equal(
    calendarLocation({ date: "2027-10-17" }, 60, now).selectedDateKey,
    "2026-10-16",
  );
  assert.equal(
    calendarLocation({ month: "2026-11" }, 60, now).selectedDateKey,
    null,
  );
});
