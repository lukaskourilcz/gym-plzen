import { databaseReady, resetDatabase, rows, stopEverything } from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { db } from "../../src/lib/db";
import {
  checkAvailability,
  checkAvailabilityBatch,
} from "../../src/lib/services/availability";
import {
  addDaysToDateKey,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const windowAt = (minute: number, date = "2030-10-28") => ({
  startsAt: localDateTimeToDate(date, minute),
  endsAt: localDateTimeToDate(date, minute + 60),
});

describe(
  "bounded read-only availability previews",
  { skip: !databaseReady },
  () => {
    beforeEach(resetDatabase);
    after(stopEverything);
    test("batch matches authoritative checks for closures, bookings, blocks, change holds and revocation holds without writes", async () => {
      const original = windowAt(600),
        moving = windowAt(780),
        revoking = windowAt(900),
        blocked = windowAt(660);
      await rows(
        "insert into reservation(starts_at,ends_at,reschedule_starts_at,reschedule_ends_at,status) values($1,$2,$3,$4,'confirmed')",
        [original.startsAt, original.endsAt, moving.startsAt, moving.endsAt],
      );
      await rows(
        "insert into reservation(starts_at,ends_at,status,access_revocation_pending) values($1,$2,'cancelled',true)",
        [revoking.startsAt, revoking.endsAt],
      );
      await rows(
        "insert into blocked_slot(starts_at,ends_at,note) values($1,$2,'private reason')",
        [blocked.startsAt, blocked.endsAt],
      );
      const windows = [
        windowAt(300),
        original,
        blocked,
        moving,
        revoking,
        windowAt(60),
      ];
      const before = await rows(
        "select to_jsonb(r) as snapshot from reservation r order by id",
      );
      assert.deepEqual(
        await checkAvailabilityBatch(windows),
        await Promise.all(
          windows.map((window) =>
            checkAvailability(window.startsAt, window.endsAt),
          ),
        ),
      );
      assert.deepEqual(
        await rows(
          "select to_jsonb(r) as snapshot from reservation r order by id",
        ),
        before,
      );
      for (const table of ["access_code", "message_delivery", "payment"])
        assert.equal((await rows(`select * from ${table}`)).length, 0);
    });
    test("ten slots use three SELECTs instead of thirty, in a read-only transaction", async () => {
      const windows = Array.from({ length: 10 }, (_, i) =>
        windowAt(300, addDaysToDateKey("2030-11-01", i)),
      );
      await checkAvailabilityBatch(windows);
      let statements: string[] = [];
      const original = db.$client.options.debug;
      db.$client.options.debug = (_connection, query) => statements.push(query);
      try {
        const baseline = await Promise.all(
          windows.map((window) =>
            checkAvailability(window.startsAt, window.endsAt),
          ),
        );
        assert.equal(
          statements.filter((query) => /^\s*select\b/i.test(query)).length,
          30,
        );
        statements = [];
        assert.deepEqual(await checkAvailabilityBatch(windows), baseline);
        assert.equal(
          statements.filter((query) => /^\s*select\b/i.test(query)).length,
          3,
        );
        assert.ok(statements.some((query) => /read only/i.test(query)));
        assert.equal(
          statements.some((query) => /\b(insert|update|delete)\b/i.test(query)),
          false,
        );
      } finally {
        db.$client.options.debug = original;
      }
    });
    test("empty and malformed selections fail closed; oversized selections are refused", async () => {
      assert.deepEqual(await checkAvailabilityBatch([]), []);
      assert.deepEqual(
        await checkAvailabilityBatch([
          { startsAt: new Date(NaN), endsAt: new Date() },
        ]),
        [{ available: false, reason: "invalid_range" }],
      );
      await assert.rejects(
        checkAvailabilityBatch(Array.from({ length: 11 }, () => windowAt(300))),
        RangeError,
      );
    });
  },
);
