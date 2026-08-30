import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateDayOverview,
  pragueDayBounds,
} from "../../src/lib/services/stats";
import type { Reservation } from "../../src/lib/db/types";

/** A reservation row with only the fields the aggregation reads. */
function reservation(
  partial: Partial<Reservation> & {
    startsAt: Date;
    status: Reservation["status"];
  },
): Reservation {
  return {
    id: `r-${partial.startsAt.toISOString()}-${partial.status}`,
    priceCents: 29000,
    ...partial,
  } as Reservation;
}

// A summer instant: Prague is UTC+2, so the local day starts at 22:00 UTC.
const NOW = new Date("2026-08-30T12:00:00.000Z");

test("the day window follows Prague midnight, not UTC midnight", () => {
  const summer = pragueDayBounds(NOW);
  assert.equal(summer.start.toISOString(), "2026-08-29T22:00:00.000Z");
  assert.equal(summer.end.toISOString(), "2026-08-30T22:00:00.000Z");

  // In winter the offset is one hour, and the bounds shift with it.
  const winter = pragueDayBounds(new Date("2026-01-15T12:00:00.000Z"));
  assert.equal(winter.start.toISOString(), "2026-01-14T23:00:00.000Z");
  assert.equal(winter.end.toISOString(), "2026-01-15T23:00:00.000Z");
});

test("revenue counts paid entries only and free ones are reported apart", () => {
  const today = [
    reservation({
      startsAt: new Date("2026-08-30T06:00:00Z"),
      status: "completed",
    }),
    reservation({
      startsAt: new Date("2026-08-30T08:00:00Z"),
      status: "confirmed",
    }),
    // The loyalty reward: an entry, but not revenue.
    reservation({
      startsAt: new Date("2026-08-30T10:00:00Z"),
      status: "confirmed",
      priceCents: 0,
    }),
    // Covered by a membership: also an entry, also not revenue.
    reservation({
      startsAt: new Date("2026-08-30T12:00:00Z"),
      status: "confirmed",
      priceCents: null,
    }),
    // A cancellation must not be counted as money or as an entry.
    reservation({
      startsAt: new Date("2026-08-30T14:00:00Z"),
      status: "cancelled",
    }),
  ];

  const overview = aggregateDayOverview(today, NOW);
  assert.equal(overview.revenueCents, 58000);
  assert.equal(overview.freeEntries, 2);
  assert.equal(overview.reservations.length, 5);
});

test("the seven-day windows do not overlap and exclude cancellations", () => {
  const day = (offset: number, status: Reservation["status"] = "confirmed") =>
    reservation({
      startsAt: new Date(NOW.getTime() - offset * 24 * 60 * 60 * 1000),
      status,
    });

  const window = [
    day(0),
    day(3),
    day(6), // still inside the last seven days
    day(7), // first day of the previous window
    day(13),
    day(2, "cancelled"),
    day(4, "no_show"),
  ];

  const overview = aggregateDayOverview(window, NOW);
  assert.equal(overview.last7, 3);
  assert.equal(overview.previous7, 2);
  assert.equal(overview.cancelledLast7, 1);
  assert.equal(overview.noShowLast7, 1);
});

test("an empty day reports zeroes rather than failing", () => {
  const overview = aggregateDayOverview([], NOW);
  assert.deepEqual(
    {
      revenueCents: overview.revenueCents,
      freeEntries: overview.freeEntries,
      last7: overview.last7,
      previous7: overview.previous7,
    },
    { revenueCents: 0, freeEntries: 0, last7: 0, previous7: 0 },
  );
});
