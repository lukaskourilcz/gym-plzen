import {
  databaseReady,
  resetDatabase,
  rows,
  stopEverything,
  resend,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { randomUUID } from "node:crypto";
import {
  loadCalendarBlockChoices,
  saveCalendarBlockSelection,
} from "../../src/lib/services/calendar-blocking";
import { cancelBlockApplication } from "../../src/lib/services/blocking";
import { checkAvailability } from "../../src/lib/services/availability";
import { createManualReservation } from "../../src/lib/services/admin-reservations";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";
const now = new Date("2026-10-16T12:00:00Z");
async function choices() {
  return loadCalendarBlockChoices(
    { from: "2026-10-24", to: "2026-10-26" },
    now,
  );
}
async function request() {
  const available = await choices();
  return {
    operationId: randomUUID(),
    scheduleFingerprint: available.scheduleFingerprint,
    windows: [available.windows[0]!, available.windows.at(-1)!].map(
      ({ startISO, endISO }) => ({ startISO, endISO }),
    ),
  };
}
async function customers() {
  return rows(
    "select row_to_json(r) as data from reservation r union all select row_to_json(c) from access_code c union all select row_to_json(p) from payment p union all select row_to_json(m) from message_delivery m union all select row_to_json(h) from opening_hours h",
  );
}
describe("calendar selection blocking", { skip: !databaseReady }, () => {
  after(stopEverything);
  beforeEach(async () => {
    await resetDatabase();
    await rows(
      "update opening_hours set open_minute=300,close_minute=1425,slot_minutes=75,is_closed=0",
    );
  });
  test("real free slots follow each weekday and Prague DST; no side effects on reads", async () => {
    await rows(
      "update opening_hours set open_minute=360,close_minute=600,slot_minutes=60 where day_of_week=6",
    );
    const before = await customers();
    const available = await choices();
    assert.equal(available.windows[0]!.startISO, "2026-10-24T04:00:00.000Z");
    assert.equal(available.windows[0]!.endISO, "2026-10-24T05:00:00.000Z");
    assert.equal(
      available.windows.find((w) => w.dateKey === "2026-10-25")!.startISO,
      "2026-10-25T04:00:00.000Z",
    );
    assert.deepEqual(await customers(), before);
    assert.equal(resend.sent.length, 0);
  });
  test("all selected slots save once, block public availability, and undo without changing bookings, PINs or messages", async () => {
    const input = await request();
    const otherStart = localDateTimeToDate("2026-10-24", 450),
      otherEnd = localDateTimeToDate("2026-10-24", 525);
    const [booking] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,status,contact_email) values($1,$2,'confirmed','synthetic@example.test') returning id",
      [otherStart, otherEnd],
    );
    await rows(
      "insert into access_code(reservation_id,code_hash,valid_from,valid_until,status) values($1,'synthetic',$2,$3,'scheduled')",
      [booking!.id, otherStart, otherEnd],
    );
    const before = await customers();
    const [a, b] = await Promise.all([
      saveCalendarBlockSelection(input, null, now),
      saveCalendarBlockSelection(input, null, now),
    ]);
    assert.deepEqual(a, b);
    assert.equal(a.count, 2);
    assert.equal((await rows("select * from block_application")).length, 1);
    assert.equal((await rows("select * from blocked_slot")).length, 2);
    assert.equal(
      (
        await rows(
          "select * from activity_log where action='blocked_slot.created'",
        )
      ).length,
      1,
    );
    for (const w of input.windows)
      assert.equal(
        (await checkAvailability(new Date(w.startISO), new Date(w.endISO)))
          .reason,
        "overlap_block",
      );
    assert.deepEqual(await customers(), before);
    assert.equal(resend.sent.length, 0);
    await cancelBlockApplication(a.id, now);
    await saveCalendarBlockSelection(input, null, now);
    assert.equal((await rows("select * from blocked_slot")).length, 0);
    assert.deepEqual(await customers(), before);
  });
  test("occupied slots, pending reschedules and unrevoked access never become choices", async () => {
    const available = await choices(),
      [a, b, c] = available.windows;
    await rows(
      "insert into reservation(starts_at,ends_at,reschedule_starts_at,reschedule_ends_at,status) values($1,$2,$3,$4,'confirmed')",
      [
        new Date(a!.startISO),
        new Date(a!.endISO),
        new Date(b!.startISO),
        new Date(b!.endISO),
      ],
    );
    await rows(
      "insert into reservation(starts_at,ends_at,status,access_revocation_pending) values($1,$2,'cancelled',true)",
      [new Date(c!.startISO), new Date(c!.endISO)],
    );
    const fresh = await choices();
    for (const blocked of [a, b, c])
      assert.ok(!fresh.windows.some((w) => w.startISO === blocked!.startISO));
  });
  test("concurrent bookings or blocks reject the entire selection and preserve the real reservation", async () => {
    for (const kind of ["booking", "block"]) {
      const input = await request(),
        clash = input.windows[1]!;
      if (kind === "booking")
        await rows(
          "insert into reservation(starts_at,ends_at,status,contact_email) values($1,$2,'confirmed','real@example.test')",
          [new Date(clash.startISO), new Date(clash.endISO)],
        );
      else
        await rows(
          "insert into blocked_slot(starts_at,ends_at) values($1,$2)",
          [new Date(clash.startISO), new Date(clash.endISO)],
        );
      const before = await customers();
      await assert.rejects(
        saveCalendarBlockSelection(input, null, now),
        /není volný/,
      );
      assert.equal((await rows("select * from block_application")).length, 0);
      assert.deepEqual(await customers(), before);
    }
    assert.equal(resend.sent.length, 0);
  });
  test("changed hours, arbitrary duration, duplicate windows and reused operation IDs are rejected", async () => {
    const input = await request();
    await rows(
      "update opening_hours set close_minute=1350 where day_of_week=0",
    );
    await assert.rejects(
      saveCalendarBlockSelection(input, null, now),
      /Rozvrh se změnil/,
    );
    const fresh = await request();
    await assert.rejects(
      saveCalendarBlockSelection(
        {
          ...fresh,
          windows: [
            {
              ...fresh.windows[0]!,
              endISO: new Date(
                new Date(fresh.windows[0]!.endISO).getTime() - 60000,
              ).toISOString(),
            },
          ],
        },
        null,
        now,
      ),
      /rozvrhu/,
    );
    await assert.rejects(
      saveCalendarBlockSelection(
        { ...fresh, windows: [fresh.windows[0]!, fresh.windows[0]!] },
        null,
        now,
      ),
      /duplicitní/,
    );
    await saveCalendarBlockSelection(fresh, null, now);
    await assert.rejects(
      saveCalendarBlockSelection(
        { ...fresh, windows: [fresh.windows[0]!] },
        null,
        now,
      ),
      /jinému výběru/,
    );
    assert.equal((await rows("select * from block_application")).length, 1);
  });
  test("database failure rolls back all blocks and audit entries", async () => {
    const input = await request();
    await rows(
      "alter table blocked_slot add constraint synthetic_selection_failure check(starts_at<'2026-10-25T00:00:00Z')",
    );
    try {
      await assert.rejects(saveCalendarBlockSelection(input, null, now));
    } finally {
      await rows(
        "alter table blocked_slot drop constraint synthetic_selection_failure",
      );
    }
    assert.equal((await rows("select * from block_application")).length, 0);
    assert.equal((await rows("select * from blocked_slot")).length, 0);
    assert.equal((await rows("select * from activity_log")).length, 0);
  });
  test("new completely empty manual bookings are refused instead of starting a customer pipeline", async () => {
    await assert.rejects(
      createManualReservation(
        {
          startsAt: localDateTimeToDate("2026-10-24", 300),
          admin: { id: randomUUID(), email: "admin@example.test" },
        },
        now,
      ),
      /Prázdné termíny blokujte/,
    );
    assert.equal((await rows("select * from reservation")).length, 0);
    assert.equal((await rows("select * from reservation_pipeline")).length, 0);
    assert.equal(resend.sent.length, 0);
  });
});
