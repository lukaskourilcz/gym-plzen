import {
  comgate,
  databaseReady,
  resend,
  resetDatabase,
  rows,
  seedProfile,
  setSetting,
  startProviders,
  stopEverything,
} from "./setup";
import { before, beforeEach, after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import {
  creditAccountForUser,
  postCreditIn,
  getCreditWallet,
} from "../../src/lib/services/credits";
import { startOrder } from "../../src/lib/services/orders";
import { synchronizeComgatePayment } from "../../src/lib/services/payments";
import {
  quoteReschedule,
  startPricedReschedule,
} from "../../src/lib/services/priced-rescheduling";
import { checkAvailability } from "../../src/lib/services/availability";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
const userId = "44444444-4444-4444-8444-444444444444";
const slot = (day: number) =>
  localDateTimeToDate(
    addDaysToDateKey(dateKeyInTimeZone(new Date()), day),
    600,
  );
async function grant(amount: number) {
  await db.transaction(async (tx) => {
    const a = await creditAccountForUser(userId, tx);
    await postCreditIn(tx, {
      accountId: a.id,
      amountCents: amount,
      reason: "Test připsání",
      key: randomUUID(),
    });
  });
}
async function paidBooking() {
  await seedProfile({
    id: userId,
    email: "ceny@example.test",
    fullName: "Cenový Test",
  });
  const order = await startOrder({
    userId,
    starts: [slot(5)],
    details: {
      name: "Cenový Test",
      email: "ceny@example.test",
      phone: "+420777000444",
      acceptedAt: new Date(),
    },
  });
  assert.equal(order.kind, "checkout");
  comgate.settle("TEST-0001", "PAID");
  await synchronizeComgatePayment("TEST-0001");
  resend.sent.length = 0;
  const [r] = await rows<{ id: string }>(
    "select id from reservation where order_id=$1",
    [order.orderId],
  );
  return r!.id;
}
async function changeInput(reservationId: string, useCredits = false) {
  const q = await quoteReschedule(userId, reservationId, slot(6));
  return {
    id: randomUUID(),
    userId,
    reservationId,
    startsAt: slot(6),
    quotedCents: q.newPriceCents,
    useCredits,
  };
}
describe("priced reservation changes", { skip: !databaseReady }, () => {
  before(startProviders);
  after(stopEverything);
  beforeEach(resetDatabase);
  test("a cheaper move grants exactly the difference once, after successful move", async () => {
    const id = await paidBooking();
    await setSetting("pricing.entry_price_cents", 19900);
    const input = await changeInput(id);
    const result = await startPricedReschedule(input);
    assert.equal(result.kind, "completed");
    assert.equal((await getCreditWallet(userId)).availableCents, 3000);
    assert.equal((await startPricedReschedule(input)).kind, "completed");
    assert.equal((await getCreditWallet(userId)).entries.length, 1);
    const [r] = await rows<{ price_cents: number; starts_at: Date }>(
      "select * from reservation where id=$1",
      [id],
    );
    assert.equal(r!.price_cents, 19900);
    assert.equal(r!.starts_at.getTime(), slot(6).getTime());
    assert.equal(
      resend.sent.filter((m) => m.to === "ceny@example.test").length,
      1,
    );
  });
  test("unpaid expensive move leaves original and messages untouched; cancellation releases target and credit", async () => {
    const id = await paidBooking();
    await grant(1000);
    await setSetting("pricing.entry_price_cents", 25900);
    const result = await startPricedReschedule(await changeInput(id, true));
    assert.equal(result.kind, "checkout");
    assert.equal((await getCreditWallet(userId)).reservedCents, 1000);
    assert.equal(comgate.creates[1]!.price, 2000);
    const [r] = await rows<{
      starts_at: Date;
      reschedule_starts_at: Date | null;
    }>("select * from reservation where id=$1", [id]);
    assert.equal(r!.starts_at.getTime(), slot(5).getTime());
    assert.equal(r!.reschedule_starts_at, null);
    assert.equal(resend.sent.length, 0);
    assert.equal(
      (await checkAvailability(slot(6), new Date(+slot(6) + 3600000)))
        .available,
      false,
    );
    comgate.settle("TEST-0002", "CANCELLED");
    await synchronizeComgatePayment("TEST-0002");
    assert.equal((await getCreditWallet(userId)).reservedCents, 0);
    assert.equal((await getCreditWallet(userId)).availableCents, 1000);
    assert.equal(resend.sent.length, 0);
    assert.equal(
      (await checkAvailability(slot(6), new Date(+slot(6) + 3600000)))
        .available,
      true,
    );
  });
  test("verified surcharge captures credit and moves once despite repeated callback", async () => {
    const id = await paidBooking();
    await grant(1000);
    await setSetting("pricing.entry_price_cents", 25900);
    const input = await changeInput(id, true);
    await startPricedReschedule(input);
    comgate.settle("TEST-0002", "PAID");
    await synchronizeComgatePayment("TEST-0002");
    await synchronizeComgatePayment("TEST-0002");
    assert.equal((await getCreditWallet(userId)).balanceCents, 0);
    const [r] = await rows<{ price_cents: number; credit_paid_cents: number }>(
      "select * from reservation where id=$1",
      [id],
    );
    assert.equal(r!.price_cents, 25900);
    assert.equal(r!.credit_paid_cents, 1000);
    assert.equal(
      (
        await rows(
          "select * from reservation_reschedule where reservation_id=$1",
          [id],
        )
      ).length,
      1,
    );
  });
  test("old bookings retain unchanged-price policy", async () => {
    const id = await paidBooking();
    await rows(
      "update reservation set pricing_version=1, price_snapshot=null where id=$1",
      [id],
    );
    await setSetting("pricing.entry_price_cents", 99900);
    const q = await quoteReschedule(userId, id, slot(6));
    assert.equal(q.newPriceCents, 22900);
    assert.equal(
      (await startPricedReschedule(await changeInput(id))).kind,
      "completed",
    );
    assert.equal((await getCreditWallet(userId)).availableCents, 0);
  });
  test("a credit-only order uses no gateway and allocates tender to each item", async () => {
    await seedProfile({
      id: userId,
      email: "ceny@example.test",
      fullName: "Cenový Test",
    });
    await grant(50000);
    const order = await startOrder({
      userId,
      useCredits: true,
      starts: [slot(5), slot(6)],
      details: {
        name: "Cenový Test",
        email: "ceny@example.test",
        phone: "+420777000444",
        acceptedAt: new Date(),
      },
    });
    assert.equal(order.kind, "free");
    assert.equal(comgate.creates.length, 0);
    assert.equal((await getCreditWallet(userId)).availableCents, 4200);
    const booked = await rows<{ credit_paid_cents: number }>(
      "select * from reservation where order_id=$1",
      [order.orderId],
    );
    assert.deepEqual(
      booked.map((r) => r.credit_paid_cents),
      [22900, 22900],
    );
  });
});
