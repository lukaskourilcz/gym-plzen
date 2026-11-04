import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  setSetting,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, describe, test } from "node:test";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
import { loadCalendarAvailability } from "../../src/lib/services/calendar-availability";
import {
  loadCalendarBlockChoices,
  saveCalendarBlockSelection,
} from "../../src/lib/services/calendar-blocking";
import { resolveOrderSlots, quoteOrder } from "../../src/lib/services/orders";
import {
  checkAvailability,
  checkAvailabilityBatch,
} from "../../src/lib/services/availability";
import { changePlannedSchedule } from "../../src/lib/services/schedule";
import { listPlannedSchedules } from "../../src/lib/services/planned-schedules";
import { loadSiteContent } from "../../src/lib/content/site";

const now = new Date();
const date = (days: number) => addDaysToDateKey(dateKeyInTimeZone(now), days);
const starts = (days: number, minute: number) =>
  localDateTimeToDate(date(days), minute);
const adminId = randomUUID();
const plan = {
  name: "Ukázkový lednový rozvrh",
  from: date(10),
  to: date(12),
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  windows: Array.from({ length: 12 }, (_, i) => ({
    startMinute: 360 + i * 80,
    endMinute: 440 + i * 80,
    priceCents: i === 1 ? 17900 : 26900,
  })),
};

describe("planned booking schedules", { skip: !databaseReady }, () => {
  beforeEach(async () => {
    await resetDatabase();
    await setSetting("booking.horizon_days", 60);
    await seedProfile({
      id: adminId,
      email: "planning-admin@example.test",
      fullName: "Testovací správce",
    });
  });
  after(stopEverything);

  test("applies inclusive dates, prices and exact slots across calendars and checkout while preserving an existing booking and its PIN", async () => {
    const [original] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,price_cents,status) values($1,$2,19900,'confirmed') returning id",
      [starts(10, 300), starts(10, 375)],
    );
    await rows(
      "insert into access_code(reservation_id,code_hash,valid_from,valid_until,status) values($1,'fictional-hash',$2,$3,'scheduled')",
      [original!.id, starts(10, 300), starts(10, 390)],
    );
    const reservations = await rows("select * from reservation");
    const codes = await rows("select * from access_code");

    const [signalBefore] = await rows<{ version: number }>(
      "select version::int from availability_signal",
    );
    await changePlannedSchedule(plan, adminId);
    const [signalAfter] = await rows<{ version: number }>(
      "select version::int from availability_signal",
    );
    assert.equal(signalAfter!.version, (signalBefore?.version ?? 0) + 1);
    const snapshot = await loadCalendarAvailability({ date: date(10) }, now);
    const slots = snapshot.view.selectedSlots;
    assert.equal(slots.length, 12);
    assert.equal(slots[0]?.startISO, starts(10, 360).toISOString());
    assert.equal(slots[0]?.booked, true);
    assert.equal(slots[1]?.booked, false);
    assert.equal(slots[1]?.durationMinutes, 80);
    assert.equal(slots[1]?.priceCents, 17900);
    assert.equal(slots.at(-1)?.startISO, starts(10, 1240).toISOString());

    const fallback = await loadCalendarAvailability({ date: date(9) }, now);
    const lastDay = await loadCalendarAvailability({ date: date(12) }, now);
    const after = await loadCalendarAvailability({ date: date(13) }, now);
    assert.deepEqual(
      [fallback, lastDay, after].map(
        (day) => day.view.selectedSlots[0]?.durationMinutes,
      ),
      [60, 80, 60],
    );

    const requested = [starts(10, 440), starts(10, 520)];
    const resolved = await resolveOrderSlots(requested);
    assert.equal(resolved[0]?.endsAt.getTime(), starts(10, 520).getTime());
    assert.deepEqual(
      (await quoteOrder({ slots: resolved, userId: null })).slots.map(
        (slot) => slot.priceCents,
      ),
      [17900, 26900],
    );
    await assert.rejects(resolveOrderSlots([starts(10, 420)]), /není dostupný/);
    assert.equal(
      (await checkAvailability(starts(10, 440), starts(10, 500))).reason,
      "closed",
    );
    assert.equal((await checkAvailabilityBatch(resolved))[0]?.available, true);
    assert.equal(
      (await checkAvailability(starts(10, 360), starts(10, 440))).reason,
      "overlap_reservation",
    );

    const content = await loadSiteContent("cs", { strict: true, at: now });
    assert.equal(content.minimumEntryPriceCents, 17900);
    assert.equal(content.entryPriceForDate(requested[0]!), 17900);
    await setSetting("pricing.time_blocks", []);
    await rows(
      "insert into pricing_period(name,price_cents,starts_at,ends_at) values('Akce',15900,$1,$2)",
      [starts(10, 0), starts(11, 0)],
    );
    assert.equal(
      (await quoteOrder({ slots: resolved, userId: null })).totalCents,
      31800,
    );

    const choices = await loadCalendarBlockChoices(
      { from: date(9), to: date(13) },
      now,
    );
    const choice = choices.windows.find(
      (window) => window.startISO === starts(10, 440).toISOString(),
    );
    assert.equal(choice?.endISO, starts(10, 520).toISOString());
    await saveCalendarBlockSelection(
      {
        operationId: randomUUID(),
        scheduleFingerprint: choices.scheduleFingerprint,
        windows: [choice!],
      },
      adminId,
      now,
    );
    assert.equal(
      (await checkAvailabilityBatch(resolved))[0]?.reason,
      "overlap_block",
    );
    assert.deepEqual(await rows("select * from reservation"), reservations);
    assert.deepEqual(await rows("select * from access_code"), codes);
    assert.equal((await rows("select * from message_delivery")).length, 0);
  });

  test("serializes conflicting saves, rejects stale edits and restores the usual schedule on removal", async () => {
    const outcomes = await Promise.allSettled([
      changePlannedSchedule(plan, adminId),
      changePlannedSchedule({ ...plan, name: "Překryv" }, adminId),
    ]);
    assert.equal(
      outcomes.filter((result) => result.status === "fulfilled").length,
      1,
    );
    const [current] = await listPlannedSchedules();
    await changePlannedSchedule(
      { ...current!, name: "Upravený rozvrh" },
      adminId,
    );
    await assert.rejects(
      changePlannedSchedule(
        { id: current!.id, revision: current!.revision, remove: true },
        adminId,
      ),
      /mezitím/,
    );
    const [updated] = await listPlannedSchedules();
    await changePlannedSchedule(
      { id: updated!.id, revision: updated!.revision, remove: true },
      adminId,
    );
    assert.deepEqual(await listPlannedSchedules(), []);
    assert.equal(
      (await loadCalendarAvailability({ date: date(10) }, now)).view
        .selectedSlots[0]?.durationMinutes,
      60,
    );
  });
  test("uses planned amounts for a real checkout and preserves its quoted price while payment is open", async () => {
    await changePlannedSchedule(plan, adminId);
    const request = {
      userId: null,
      starts: [starts(10, 440)],
      details: {
        name: "Ukázkový návštěvník",
        email: "plan-checkout@example.test",
        phone: "+420777000111",
        acceptedAt: now,
      },
    };
    const order = await startOrder(request);
    assert.equal(order.kind, "checkout");
    if (order.kind !== "checkout") return;
    assert.equal(order.totalCents, 17900);
    const [current] = await listPlannedSchedules();
    await assert.rejects(
      changePlannedSchedule(
        {
          ...current!,
          windows: current!.windows.filter((w) => w.startMinute !== 440),
        },
        adminId,
      ),
      /dokončení platby/,
    );
    await changePlannedSchedule(
      {
        ...current!,
        windows: current!.windows.map((w) => ({ ...w, priceCents: 29900 })),
      },
      adminId,
    );
    const resumed = await startOrder({
      ...request,
      hold: { kind: "order", id: order.orderId, token: order.token! },
    });
    assert.equal(resumed.kind, "checkout");
    if (resumed.kind !== "checkout") return;
    assert.equal(resumed.url, order.url);
    assert.equal(resumed.totalCents, 17900);
    assert.equal((await rows("select * from message_delivery")).length, 0);
  });
});
