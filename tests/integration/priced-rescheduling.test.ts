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
import { issueDocumentFor } from "../../src/lib/services/invoices";
import { reservationInvoiceStates } from "../../src/lib/services/invoice-delivery";
import { getReservation } from "../../src/lib/services/reservations";
import { addParticipants } from "../../src/lib/services/participants";
import {
  cancelReservation,
  cancelByCustomer,
} from "../../src/lib/services/reservations";
import { confirmChangeRefund } from "../../src/lib/services/credit-admin";

import { before, beforeEach, after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { payment } from "../../src/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  creditAccountForUser,
  postCreditIn,
  getCreditWallet,
  reserveCreditIn,
} from "../../src/lib/services/credits";
import { startOrder } from "../../src/lib/services/orders";
import {
  synchronizeComgatePayment,
  startOrderPayment,
} from "../../src/lib/services/payments";
import {
  quoteReschedule,
  startPricedReschedule,
  recoverFailedChange,
  retryPaidChanges,
  synchronizeChangePayment,
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
    assert.equal((comgate.creates[1] as { price: number }).price, 2000);
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
  test("resuming a partly credit-paid checkout preserves the agreed cash and credit amounts", async () => {
    await seedProfile({
      id: userId,
      email: "ceny@example.test",
      fullName: "Cenový Test",
    });
    await grant(10000);
    const params = {
      userId,
      useCredits: true,
      quotedCreditCents: 10000,
      starts: [slot(5)],
      details: {
        name: "Cenový Test",
        email: "ceny@example.test",
        phone: "+420777000444",
        acceptedAt: new Date(),
      },
    };
    const first = await startOrder(params);
    assert.equal(first.kind, "checkout");
    await assert.rejects(
      startOrder({ ...params, quotedCreditCents: 0, useCredits: false }),
      /Rozpracovaná platba/,
    );
    const resumed = await startOrder(params);
    assert.equal(resumed.kind, "checkout");
    assert.equal(resumed.orderId, first.orderId);
    assert.equal(comgate.creates.length, 1);
    assert.equal((comgate.creates[0] as { price: number }).price, 12900);
    assert.equal((await getCreditWallet(userId)).reservedCents, 10000);
    comgate.settle("TEST-0001", "PAID");
    await synchronizeComgatePayment("TEST-0001");
    assert.equal((await getCreditWallet(userId)).balanceCents, 0);
  });
  test("an interrupted fully credit-funded order resumes without a gateway or duplicate debit", async () => {
    await seedProfile({
      id: userId,
      email: "ceny@example.test",
      fullName: "Cenový Test",
    });
    await grant(50000);
    const [order] = await rows<{ id: string }>(
      "insert into booking_order(user_id,status,total_cents,credit_cents,contact_email) values($1,'pending',22900,22900,'ceny@example.test') returning id",
      [userId],
    );
    await rows(
      "insert into reservation(user_id,order_id,starts_at,ends_at,status,price_cents,contact_email) values($1,$2,$3,$4,'pending',22900,'ceny@example.test')",
      [userId, order!.id, slot(5), new Date(+slot(5) + 75 * 60000)],
    );
    // Simulate a process stop between durable funding and final confirmation.
    await db.transaction((tx) =>
      reserveCreditIn(tx, userId, `order:${order!.id}`, 22900, true),
    );
    const result = await startOrderPayment({ userId, orderId: order!.id });
    assert.equal(result.kind, "free");
    assert.equal(comgate.creates.length, 0);
    assert.equal((await getCreditWallet(userId)).availableCents, 27100);
    await assert.rejects(
      startOrderPayment({ userId, orderId: order!.id }),
      /nelze uhradit/,
    );
    assert.equal(
      (await getCreditWallet(userId)).entries.filter((e) => e.amountCents < 0)
        .length,
      1,
    );
    assert.equal(
      (
        await rows<{ status: string }>(
          "select status from reservation where order_id=$1",
          [order!.id],
        )
      )[0]!.status,
      "confirmed",
    );
  });
  test("a failed paid move restores availability and requests one refund, then an admin confirms provider completion", async () => {
    const id = await paidBooking();
    await grant(1000);
    await setSetting("pricing.entry_price_cents", 25900);
    const input = await changeInput(id, true);
    await startPricedReschedule(input);
    // The schedule was edited after quoting/payment; never move to rounded times.
    await rows("update opening_hours set is_closed=1");
    comgate.settle("TEST-0002", "PAID");
    await synchronizeComgatePayment("TEST-0002");
    await recoverFailedChange(input.id);
    await recoverFailedChange(input.id);
    assert.equal(comgate.refunds.length, 1);
    assert.equal((await getCreditWallet(userId)).availableCents, 1000);
    const [change] = await rows<{ status: string; refund_state: string }>(
      "select * from reservation_change where id=$1",
      [input.id],
    );
    assert.equal(change!.status, "refund_pending");
    assert.equal(change!.refund_state, "requested");
    assert.equal(resend.sent.length, 0, "no completed-change mail");
    const [stalePayment] = await db
      .select()
      .from(payment)
      .where(eq(payment.reservationChangeId, input.id));
    await confirmChangeRefund(input.id, "Refund verified in fixture", userId);
    // Dispatcher may have read this row before an operator confirms refund.
    await synchronizeChangePayment(stalePayment!, "TEST-0002");
    await synchronizeComgatePayment("TEST-0002");
    const [p] = await rows<{ status: string }>(
      "select * from payment where reservation_change_id=$1",
      [input.id],
    );
    assert.equal(p!.status, "refunded");
    const [booking] = await rows<{ starts_at: Date }>(
      "select * from reservation where id=$1",
      [id],
    );
    assert.equal(booking!.starts_at.getTime(), slot(5).getTime());
  });
  test("a verified late payment after cancellation is refunded without moving the original", async () => {
    const id = await paidBooking();
    await setSetting("pricing.entry_price_cents", 25900);
    const input = await changeInput(id);
    await startPricedReschedule(input);
    comgate.settle("TEST-0002", "CANCELLED");
    await synchronizeComgatePayment("TEST-0002");
    comgate.settle("TEST-0002", "PAID");
    await synchronizeComgatePayment("TEST-0002");
    await retryPaidChanges();
    assert.equal(comgate.refunds.length, 1);
    const [change] = await rows<{ status: string; refund_state: string }>(
      "select * from reservation_change where id=$1",
      [input.id],
    );
    assert.equal(change!.status, "refund_pending");
    assert.equal(change!.refund_state, "requested");
    assert.equal(
      (await getReservation(id))!.startsAt.getTime(),
      slot(5).getTime(),
    );
    assert.equal(resend.sent.length, 0);
  });
  test("refunds waiting for operator confirmation do not starve new recovery work", async () => {
    const id = await paidBooking();
    await setSetting("pricing.entry_price_cents", 25900);
    const first = await changeInput(id);
    await startPricedReschedule(first);
    await rows(
      "update reservation_change set expires_at=now()-interval '1 second' where id=$1",
      [first.id],
    );
    comgate.settle("TEST-0002", "PAID");
    await synchronizeComgatePayment("TEST-0002");
    await recoverFailedChange(first.id);
    await rows(
      "update reservation_change set updated_at=now()-interval '1 day' where id=$1",
      [first.id],
    );
    const order = await startOrder({
      userId,
      starts: [slot(8)],
      details: {
        name: "Cenový Test",
        email: "ceny@example.test",
        phone: "+420777000444",
        acceptedAt: new Date(),
      },
    });
    comgate.settle("TEST-0003", "PAID");
    await synchronizeComgatePayment("TEST-0003");
    const [other] = await rows<{ id: string }>(
      "select id from reservation where order_id=$1",
      [order.orderId],
    );
    await setSetting("pricing.entry_price_cents", 28900);
    const q = await quoteReschedule(userId, other!.id, slot(9));
    const second = {
      id: randomUUID(),
      userId,
      reservationId: other!.id,
      startsAt: slot(9),
      quotedCents: q.newPriceCents,
      useCredits: false,
    };
    await startPricedReschedule(second);
    await rows(
      "update reservation_change set expires_at=now()-interval '1 second' where id=$1",
      [second.id],
    );
    comgate.settle("TEST-0004", "PAID");
    await synchronizeComgatePayment("TEST-0004");
    await retryPaidChanges(1);
    assert.equal(comgate.refunds.length, 2);
  });
  test("a lost refund response is never automatically sent twice", async () => {
    const id = await paidBooking();
    await setSetting("pricing.entry_price_cents", 25900);
    const input = await changeInput(id);
    await startPricedReschedule(input);
    await rows(
      "update reservation_change set expires_at=now()-interval '1 second' where id=$1",
      [input.id],
    );
    comgate.settle("TEST-0002", "PAID");
    await synchronizeComgatePayment("TEST-0002");
    comgate.loseNextRefundResponse();
    await recoverFailedChange(input.id);
    await recoverFailedChange(input.id);
    await retryPaidChanges();
    assert.equal(comgate.refunds.length, 1);
    const [r] = await rows<{ refund_state: string }>(
      "select * from reservation_change where id=$1",
      [input.id],
    );
    assert.equal(r!.refund_state, "unknown");
  });
  test("customer cancellation forfeits credit, operator cancellation returns the remaining credit once", async () => {
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
    const bookings = await rows<{ id: string }>(
      "select id from reservation where order_id=$1 order by starts_at",
      [order.orderId],
    );
    await cancelByCustomer({ reservationId: bookings[0]!.id, userId });
    assert.equal((await getCreditWallet(userId)).availableCents, 4200);
    await cancelReservation({ id: bookings[1]!.id, byAdminId: userId });
    await cancelReservation({ id: bookings[1]!.id, byAdminId: userId });
    assert.equal((await getCreditWallet(userId)).availableCents, 27100);
  });
  test("companion credit is captured separately without a code or gateway purchase", async () => {
    const id = await paidBooking();
    await grant(10000);
    const outcome = await addParticipants({
      userId,
      reservationId: id,
      toCount: 1,
      quotedCents: 10000,
      useCredits: true,
      quotedCreditCents: 10000,
    });
    assert.equal(outcome.kind, "confirmed");
    assert.equal(comgate.creates.length, 1);
    assert.equal((await getCreditWallet(userId)).availableCents, 0);
    const [r] = await rows<{
      extra_people: number;
      additional_people_paid_cents: number;
    }>("select * from reservation where id=$1", [id]);
    assert.equal(r!.extra_people, 1);
    assert.equal(r!.additional_people_paid_cents, 10000);
    assert.equal(resend.sent.length, 0);
  });
  test("credit consumed elsewhere invalidates a shown quote without a larger unapproved gateway charge", async () => {
    const id = await paidBooking();
    await grant(1000);
    await setSetting("pricing.entry_price_cents", 25900);
    const input = await changeInput(id, true);
    await assert.rejects(
      startPricedReschedule({ ...input, quotedCreditCents: 2000 }),
      /kredit se změnil/,
    );
    assert.equal(comgate.creates.length, 1);
    assert.equal((await rows("select * from reservation_change")).length, 0);
    assert.equal((await getCreditWallet(userId)).reservedCents, 0);
  });
  test("completed financial history is immutable and confirmation includes cash/credit facts even with an old custom template", async () => {
    const id = await paidBooking();
    await setSetting("messages.email.reservation_rescheduled", {
      subject: "Změna",
      body: "Nový termín: {time}",
    });
    await setSetting("pricing.entry_price_cents", 19900);
    const input = await changeInput(id);
    await startPricedReschedule(input);
    assert.match(resend.sent[0]!.text ?? "", /Připsaný kredit: 30/);
    await assert.rejects(
      rows("update reservation_change set new_price_cents=1 where id=$1", [
        input.id,
      ]),
      /immutable/,
    );
  });
  test("a credit-only receipt retains original order values even if one slot later becomes cheaper", async () => {
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
    const [r] = await rows<{ id: string }>(
      "select id from reservation where order_id=$1 order by starts_at",
      [order.orderId],
    );
    assert.equal(
      (await reservationInvoiceStates([r!.id])).get(r!.id)!.eligible,
      true,
    );
    await setSetting("pricing.entry_price_cents", 19900);
    const quote = await quoteReschedule(userId, r!.id, slot(7));
    await startPricedReschedule({
      ...(await changeInput(r!.id)),
      startsAt: slot(7),
      quotedCents: quote.newPriceCents,
    });
    await setSetting("billing.profile", {
      legalName: "Lokální faktura s.r.o.",
      street: "Testovací 1",
      city: "Plzeň",
      zip: "301 00",
      ico: "12345678",
      dic: "",
      vatRatePercent: 0,
      bankAccount: "",
      registryNote: "",
    });
    const outcome = await issueDocumentFor((await getReservation(r!.id))!, {
      force: true,
    });
    assert.equal(outcome.issued, true);
    if (!outcome.issued) throw new Error("receipt missing");
    assert.equal(outcome.invoice.totalCents, 45800);
    assert.equal(outcome.invoice.creditCents, 45800);
    assert.deepEqual(
      outcome.invoice.items!.map((i) => i.totalCents),
      [22900, 22900],
    );
  });
  test("the tenth reward stays free and cannot mint a nominal-price credit", async () => {
    await seedProfile({
      id: userId,
      email: "ceny@example.test",
      fullName: "Cenový Test",
    });
    await rows(
      "insert into reservation(user_id,starts_at,ends_at,status,price_cents) select $1::uuid,'2025-01-01'::timestamptz+n*interval '1 day','2025-01-01 01:00'::timestamptz+n*interval '1 day','completed',19900 from generate_series(1,9)n",
      [userId],
    );
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
    assert.equal(order.kind, "free");
    const [r] = await rows<{ id: string }>(
      "select id from reservation where order_id=$1",
      [order.orderId],
    );
    await setSetting("pricing.entry_price_cents", 99900);
    const q = await quoteReschedule(userId, r!.id, slot(6));
    assert.equal(q.newPriceCents, 0);
    await startPricedReschedule(await changeInput(r!.id));
    assert.equal((await getCreditWallet(userId)).availableCents, 0);
    assert.equal(comgate.creates.length, 0);
  });
  test("a worker crash cannot apply a once-paid move after its offer has expired", async () => {
    const id = await paidBooking();
    await setSetting("pricing.entry_price_cents", 25900);
    const input = await changeInput(id);
    await startPricedReschedule(input);
    comgate.settle("TEST-0002", "PAID");
    // Durable boundary: provider verification committed, worker died before apply.
    await rows(
      "update payment set status='succeeded',paid_at=now() where reservation_change_id=$1",
      [input.id],
    );
    await rows(
      "update reservation_change set status='applying',expires_at=now()-interval '1 second' where id=$1",
      [input.id],
    );
    await retryPaidChanges();
    const [r] = await rows<{ starts_at: Date }>(
      "select * from reservation where id=$1",
      [id],
    );
    assert.equal(r!.starts_at.getTime(), slot(5).getTime());
    assert.equal(
      (await rows("select * from reservation_reschedule")).length,
      0,
    );
    assert.equal(comgate.refunds.length, 1);
    assert.equal(resend.sent.length, 0);
  });
});
