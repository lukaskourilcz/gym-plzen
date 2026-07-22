import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
  minuteOfDay,
  monthGrid,
} from "../../src/lib/helpers/datetime";
import { formatTimeRange } from "../../src/lib/helpers/format";

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
  assert.equal(formatTimeRange(start, end), "8:00–9:15");
});
