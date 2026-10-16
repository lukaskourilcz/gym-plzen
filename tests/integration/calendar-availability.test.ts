import {
  databaseReady,
  resetDatabase,
  rows,
  setSetting,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "../../src/lib/db";
import { loadCalendarAvailability } from "../../src/lib/services/calendar-availability";
import { loadSiteContent } from "../../src/lib/content/site";
import { GET } from "../../src/app/api/availability/calendar/route";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";
const now = new Date("2026-10-16T12:00:00Z");
describe(
  "lightweight public calendar snapshot",
  { skip: !databaseReady },
  () => {
    beforeEach(async () => {
      await resetDatabase();
      await setSetting("booking.horizon_days", 60);
    });
    after(stopEverything);
    test("uses five SELECTs, no CMS/auth/providers/writes, and exposes no contacts or block reasons", async () => {
      const start = localDateTimeToDate("2026-10-17", 600),
        end = localDateTimeToDate("2026-10-17", 660);
      await rows(
        "insert into reservation (starts_at,ends_at,status,contact_email,contact_name) values ($1,$2,'pending','private@example.test','PRIVATE-NAME')",
        [start, end],
      );
      await rows(
        "insert into blocked_slot (starts_at,ends_at,note) values ($1,$2,'PRIVATE-BLOCK')",
        [
          localDateTimeToDate("2026-10-17", 660),
          localDateTimeToDate("2026-10-17", 720),
        ],
      );
      await loadCalendarAvailability({ date: "2026-10-17" }, now);
      const statements: string[] = [];
      const original = db.$client.options.debug;
      db.$client.options.debug = (_conn, query) => statements.push(query);
      let snapshot;
      try {
        snapshot = await loadCalendarAvailability({ date: "2026-10-17" }, now);
      } finally {
        db.$client.options.debug = original;
      }
      assert.equal(
        statements.filter((query) => /^\s*select\b/i.test(query)).length,
        5,
      );
      assert.ok(
        statements.every(
          (query) =>
            /^\s*select\b/i.test(query) ||
            /^(?:begin(?: read only)?|set transaction read only|commit|rollback|set local statement_timeout = '5s'|set local lock_timeout = '2s')$/i.test(
              query.trim(),
            ),
        ),
      );
      assert.equal(
        statements.some((query) => /content_block|auth\.|profiles/.test(query)),
        false,
      );
      const body = JSON.stringify(snapshot.view);
      assert.equal(
        /PRIVATE|private@example|reservationId|blockIds/.test(body),
        false,
      );
      assert.equal(
        snapshot.view.selectedSlots.filter((slot) => slot.booked).length,
        2,
      );
      assert.equal(snapshot.view.days.length, 42);
      assert.equal((await rows("select * from access_code")).length, 0);
      assert.equal((await rows("select * from message_delivery")).length, 0);
    });
    test("per-slot block prices and date periods match checkout CMS pricing, including DST", async () => {
      await rows(
        "insert into pricing_period (name,price_cents,starts_at,ends_at) values ('Synthetic period',19900,$1,$2)",
        [
          localDateTimeToDate("2026-10-25", 0),
          localDateTimeToDate("2026-10-26", 0),
        ],
      );
      await setSetting("pricing.time_blocks", [
        {
          id: randomUUID(),
          dayOfWeek: 0,
          startMinute: 600,
          endMinute: 660,
          priceCents: 32900,
        },
      ]);
      const snapshot = await loadCalendarAvailability(
        { date: "2026-10-25" },
        now,
      );
      const content = await loadSiteContent("cs", { strict: true });
      for (const slot of snapshot.view.selectedSlots)
        assert.equal(
          slot.priceCents,
          content.entryPriceForDate(new Date(slot.startISO)),
        );
      assert.equal(
        snapshot.view.selectedSlots.find(
          (slot) =>
            slot.startISO ===
            localDateTimeToDate("2026-10-25", 600).toISOString(),
        )?.priceCents,
        32900,
      );
      assert.equal(
        snapshot.view.selectedSlots.find(
          (slot) =>
            slot.startISO ===
            localDateTimeToDate("2026-10-25", 660).toISOString(),
        )?.priceCents,
        19900,
      );
    });
    test("API rejects invalid dates, disables shared caching and fails closed on database errors", async () => {
      assert.equal(
        (
          await GET(
            new NextRequest(
              "http://localhost/api/availability/calendar?date=2026-02-30",
            ),
          )
        ).status,
        400,
      );
      const result = await GET(
        new NextRequest("http://localhost/api/availability/calendar"),
      );
      assert.equal(result.status, 200);
      assert.equal(result.headers.get("cache-control"), "no-store");
      const original = db.transaction;
      db.transaction = (() =>
        Promise.reject(new Error("synthetic outage"))) as typeof db.transaction;
      try {
        const failure = await GET(
          new NextRequest("http://localhost/api/availability/calendar"),
        );
        assert.equal(failure.status, 503);
        assert.deepEqual(await failure.json(), { error: "unavailable" });
      } finally {
        db.transaction = original;
      }
    });
  },
);
