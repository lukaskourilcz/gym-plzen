import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
  minuteOfDay,
  monthGrid,
} from "../../src/lib/helpers/datetime";
import { formatDate, formatTimeRange } from "../../src/lib/helpers/format";

test("month grid is Monday-first and always has six complete weeks", () => {
  const grid = monthGrid("2026-07");
  assert.equal(grid.length, 42);
  assert.equal(grid[0]?.dateKey, "2026-06-29");
  assert.equal(grid[41]?.dateKey, "2026-08-09");
});

test("date-key arithmetic is stable across Prague DST changes", () => {
  assert.equal(addDaysToDateKey("2026-03-28", 1), "2026-03-29");
  assert.equal(addDaysToDateKey("2026-10-24", 1), "2026-10-25");
});

test("Prague wall-clock conversion respects summer and winter offsets", () => {
  const summer = localDateTimeToDate("2026-03-29", 8 * 60);
  const winter = localDateTimeToDate("2026-10-25", 8 * 60);
  assert.equal(summer.toISOString(), "2026-03-29T06:00:00.000Z");
  assert.equal(winter.toISOString(), "2026-10-25T07:00:00.000Z");
  assert.equal(dateKeyInTimeZone(summer), "2026-03-29");
  assert.equal(minuteOfDay(winter), 8 * 60);
});

test("exact ranges render the authoritative end time", () => {
  const start = localDateTimeToDate("2026-07-22", 8 * 60);
  const end = localDateTimeToDate("2026-07-22", 9 * 60 + 15);
  // Non-breaking spaces flank the dash so a range never wraps mid-way.
  assert.equal(formatTimeRange(start, end), "8:00 – 9:15");
});

test("account dates do not repeat the start time", () => {
  const start = new Date("2026-07-24T15:00:00.000Z");
  assert.equal(formatDate(start), "24. 7. 2026");
});

test("formatters are constructed once and cached conversions stay correct", async () => {
  const { cachedDateTimeFormat } =
    await import("../../src/lib/helpers/datetime");
  const options = { timeZone: "Europe/Prague", weekday: "short" } as const;
  assert.equal(
    cachedDateTimeFormat("en-US", options),
    cachedDateTimeFormat("en-US", options),
  );
  assert.notEqual(
    cachedDateTimeFormat("en-US", options),
    cachedDateTimeFormat("cs-CZ", options),
  );
  // A cached wall-clock conversion returns the same instant as a fresh one,
  // and a distinct Date object each time so callers can never mutate the cache.
  const first = localDateTimeToDate("2026-10-25", 5 * 60);
  const second = localDateTimeToDate("2026-10-25", 5 * 60);
  assert.equal(first.getTime(), second.getTime());
  assert.notEqual(first, second);
  assert.equal(first.toISOString(), "2026-10-25T04:00:00.000Z");
  assert.equal(
    localDateTimeToDate("2026-10-25", 1 * 60).toISOString(),
    "2026-10-24T23:00:00.000Z",
  );
});
