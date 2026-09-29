import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aggregateStats,
  aggregateDayOverview,
} from "../../src/lib/services/stats";
import type { Reservation } from "../../src/lib/db/types";

test("monthly history uses the latest twelve calendar months in chronological order", () => {
  const rows = Array.from({ length: 14 }, (_, index) => ({
    startsAt: new Date(Date.UTC(2025, index, 15, 12)),
    status: "confirmed",
  })).reverse();
  const stats = aggregateStats(rows, new Date("2026-03-01T12:00Z"));
  assert.equal(stats.byMonth.length, 12);
  const label = new Intl.DateTimeFormat("cs-CZ", {
    month: "short",
    year: "numeric",
    timeZone: "Europe/Prague",
  });
  assert.equal(
    stats.byMonth[0]?.label,
    label.format(new Date("2025-03-15T12:00Z")),
  );
  assert.equal(
    stats.byMonth.at(-1)?.label,
    label.format(new Date("2026-02-15T12:00Z")),
  );
  // The result cannot depend on the DB's ordering or an additional old visit.
  assert.deepEqual(
    aggregateStats([...rows.slice(4), ...rows.slice(0, 4)]).byMonth,
    stats.byMonth,
  );
});

test("seven-day reporting uses Prague calendar days across autumn DST", () => {
  const visit = {
    startsAt: new Date("2026-10-24T22:30Z"),
    status: "confirmed",
    priceCents: 22900,
  } as Reservation;
  // Local 00:30 on Oct 25 is the first day of Oct 25–31, though that week
  // is 169 hours long. It belongs to last7, not previous7.
  const stats = aggregateDayOverview([visit], new Date("2026-10-31T12:00Z"));
  assert.equal(stats.last7, 1);
  assert.equal(stats.previous7, 0);
});

test("seven-day reporting does not include the previous day across spring DST", () => {
  const visit = {
    startsAt: new Date("2026-03-28T22:30Z"),
    status: "confirmed",
    priceCents: 22900,
  } as Reservation;
  // Local 23:30 on Mar 28 is before the Mar 29–Apr 4 reporting week.
  const stats = aggregateDayOverview([visit], new Date("2026-04-04T12:00Z"));
  assert.equal(stats.last7, 0);
  assert.equal(stats.previous7, 1);
});
