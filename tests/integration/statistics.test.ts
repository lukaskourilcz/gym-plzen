import { databaseReady, resetDatabase, rows, stopEverything } from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { aggregateStats, getStats } from "../../src/lib/services/stats";

describe(
  "complete-history statistics (#172, #174)",
  { skip: !databaseReady },
  () => {
    after(stopEverything);
    beforeEach(resetDatabase);
    test("empty and 5001+ row history preserve Prague buckets, all statuses and exact time boundaries", async () => {
      const now = new Date("2026-10-25T01:30:00Z");
      assert.deepEqual(await getStats(now), aggregateStats([], now));
      await rows(`insert into reservation (starts_at,ends_at,status,price_cents)
      select '2020-01-01'::timestamptz + n*interval '75 minutes', '2020-01-01'::timestamptz + (n+1)*interval '75 minutes','completed',22900 from generate_series(0,5000) n`);
      for (const [at, status] of [
        ["2026-09-25T01:29:59.999Z", "completed"],
        ["2026-09-25T01:30:00Z", "no_show"],
        ["2026-10-25T00:30:00Z", "pending"],
        ["2026-10-25T01:30:00Z", "confirmed"],
        ["2026-10-25T03:30:00Z", "cancelled"],
        ["2026-10-26T22:30:00Z", "completed"],
      ])
        await rows(
          "insert into reservation (starts_at,ends_at,status,price_cents) values ($1,$1::timestamptz+interval '30 minutes',$2,22900)",
          [at, status],
        );
      const all = await rows<{ starts_at: Date; status: string }>(
        "select starts_at,status from reservation",
      );
      const expected = aggregateStats(
        all.map(({ starts_at, status }) => ({ startsAt: starts_at, status })),
        now,
      );
      const actual = await getStats(now);
      assert.deepEqual(actual, expected);
      assert.equal(actual.total, 5007);
      assert.equal(actual.last30, 3);
    });
  },
);
