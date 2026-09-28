/**
 * Multi-slot orders end to end against a local Postgres, with Comgate and
 * Resend replaced by the recording stand-ins: one payment for several slots,
 * loyalty across the slots of one order, one voucher per order, conflicts,
 * cancellation of the payment and of one paid slot, and checkout expiry.
 *
 *   npm run test:integration        # needs DATABASE_URL to a local Postgres
 */
import {
  comgate,
  databaseReady,
  resend,
  resetDatabase,
  rows,
  seedProfile,
  seedVoucher,
  setSetting,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  getOrderConfirmation,
  startOrder,
} from "../../src/lib/services/orders";
import { startBooking } from "../../src/lib/services/booking";
import { synchronizeComgatePayment } from "../../src/lib/services/payments";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import {
  cancelReservation,
  listHistoryForUser,
  releaseExpiredPendingReservations,
} from "../../src/lib/services/reservations";
import { listCustomerOrders } from "../../src/lib/services/customer-orders";
import { formatDateTime } from "../../src/lib/helpers/format";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const PRICE = 22_900;
const MEMBER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "objednavky@example.test",
  fullName: "Olga Objednávková",
};
const GUEST = {
  name: "Hana Hostová",
  email: "hana@example.test",
  phone: "+420733000333",
};

function slot(daysAhead: number, minute = 10 * 60): Date {
  return localDateTimeToDate(
    addDaysToDateKey(dateKeyInTimeZone(new Date()), daysAhead),
    minute,
  );
}

function details(overrides: Partial<typeof GUEST> = {}) {
  return { ...GUEST, ...overrides, acceptedAt: new Date() };
}

async function orderRow(id: string) {
  const [row] = await rows<{
    status: string;
    total_cents: number;
    voucher_id: string | null;
    cancel_reason: string | null;
  }>("select * from booking_order where id = $1", [id]);
  assert.ok(row, `order ${id} exists`);
  return row;
}

async function slotsOf(orderId: string) {
  return rows<{
    id: string;
    status: string;
    price_cents: number;
    loyalty_reward: number | null;
    starts_at: Date;
  }>(
    "select id, status, price_cents, loyalty_reward, starts_at from reservation where order_id = $1 order by starts_at",
    [orderId],
  );
}

async function count(table: string): Promise<number> {
  const [row] = await rows<{ n: string }>(
    `select count(*)::text as n from ${table}`,
  );
  return Number(row?.n ?? 0);
}

/** Give a member counted history, as confirmed past-looking reservations. */
async function seedEntries(userId: string, entries: number) {
  for (let index = 0; index < entries; index++)
    await rows(
      `insert into reservation (user_id, starts_at, ends_at, status, price_cents)
       values ($1, now() - ($2 || ' days')::interval, now() - ($2 || ' days')::interval + interval '75 minutes', 'confirmed', ${PRICE})`,
      [userId, String(200 + index)],
    );
}

describe(
  "multi-slot orders",
  { skip: !databaseReady && "needs a local DATABASE_URL" },
  () => {
    before(async () => {
      await startProviders();
    });
    after(async () => {
      await stopEverything();
    });
    beforeEach(async () => {
      await resetDatabase();
    });

    test("a guest pays once for three slots and all three are confirmed together", async () => {
      const starts = [slot(5), slot(3), slot(4)];
      const outcome = await startOrder({
        userId: null,
        starts,
        details: details(),
      });
      assert.equal(outcome.kind, "checkout");
      if (outcome.kind !== "checkout") return;
      assert.equal(outcome.totalCents, 3 * PRICE);
      assert.ok(outcome.token);

      // One gateway payment for the whole order, bound to it.
      assert.equal(comgate.creates.length, 1);
      assert.equal((comgate.creates[0] as { price: number }).price, 3 * PRICE);
      const [attempt] = await rows<{
        order_id: string;
        reservation_id: string | null;
        amount_cents: number;
      }>("select order_id, reservation_id, amount_cents from payment");
      assert.equal(attempt?.order_id, outcome.orderId);
      assert.equal(attempt?.reservation_id, null);

      const held = await slotsOf(outcome.orderId);
      assert.equal(held.length, 3);
      assert.deepEqual(
        held.map((row) => row.starts_at.getTime()),
        [slot(3), slot(4), slot(5)].map((at) => at.getTime()),
      );
      assert.ok(held.every((row) => row.status === "pending"));
      assert.equal(
        (
          await getOrderConfirmation({
            userId: null,
            orderId: outcome.orderId,
            token: outcome.token,
          })
        ).state,
        "processing",
      );

      comgate.settle("TEST-0001", "PAID");
      assert.equal(await synchronizeComgatePayment("TEST-0001"), true);

      assert.equal((await orderRow(outcome.orderId)).status, "confirmed");
      const confirmed = await slotsOf(outcome.orderId);
      assert.ok(confirmed.every((row) => row.status === "confirmed"));
      const [pipelines] = await rows<{ n: string }>(
        "select count(*)::text as n from reservation_pipeline where reservation_id in (select id from reservation where order_id = $1)",
        [outcome.orderId],
      );
      assert.equal(Number(pipelines?.n), 9);

      const confirmation = await getOrderConfirmation({
        userId: null,
        orderId: outcome.orderId,
        token: outcome.token,
      });
      assert.equal(confirmation.state, "confirmed");
      if (confirmation.state === "confirmed") {
        assert.equal(confirmation.slots.length, 3);
        assert.equal(confirmation.totalCents, 3 * PRICE);
      }
      assert.equal(
        (
          await getOrderConfirmation({
            userId: null,
            orderId: outcome.orderId,
            token: "0".repeat(64),
          })
        ).state,
        "invalid",
      );
    });

    test("a paid order sends one confirmation, one document and one operator notice", async () => {
      await setSetting("billing.send_documents", true);
      await setSetting("billing.profile", {
        legalName: "Ukázka Fitness s.r.o.",
        street: "Americká 1234/56",
        city: "Plzeň",
        zip: "301 00",
        ico: "12345678",
        dic: "",
        vatRatePercent: 0,
        bankAccount: "",
        registryNote: "",
      });
      const recipients = "provoz@example.test";
      const [current] = await rows<{ value: { events: unknown } }>(
        "select value from site_setting where key = 'notifications.operator'",
      );
      await setSetting("notifications.operator", {
        recipients,
        events: current?.value.events,
      });
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4), slot(5)],
        details: details(),
      });
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      // The watchdog retrying every slot changes nothing.
      for (const row of await slotsOf(outcome.orderId))
        await fulfillReservation(row.id);

      const toCustomer = resend.sent.filter((mail) => mail.to === GUEST.email);
      const confirmations = toCustomer.filter((mail) =>
        mail.subject.startsWith("Potvrzení objednávky"),
      );
      assert.equal(confirmations.length, 1);
      assert.equal(
        toCustomer.filter((mail) =>
          mail.subject.startsWith("Potvrzení rezervace"),
        ).length,
        0,
      );
      const mail = confirmations[0]!;
      assert.match(mail.text ?? "", /Rezervovali jste 3 termíny/);
      assert.match(mail.text ?? "", /Celkem: 687\sKč/);
      const ics = Buffer.from(mail.attachments![0]!.content, "base64").toString(
        "utf8",
      );
      assert.equal(ics.match(/BEGIN:VEVENT/g)?.length, 3);

      const documents = await rows<{
        order_id: string;
        total_cents: number;
        items: { totalCents: number }[];
      }>("select order_id, total_cents, items from invoice");
      assert.equal(documents.length, 1);
      assert.equal(documents[0]?.order_id, outcome.orderId);
      assert.equal(documents[0]?.total_cents, 3 * PRICE);
      assert.deepEqual(
        documents[0]?.items.map((item) => item.totalCents),
        [PRICE, PRICE, PRICE],
      );
      assert.equal(
        toCustomer.filter((mail) => mail.subject.startsWith("Doklad")).length,
        1,
      );

      const notices = resend.sent.filter((mail) => mail.to === recipients);
      assert.equal(notices.length, 1);
      assert.match(notices[0]!.text ?? "", /objednávku 3 termínů/);
    });

    test("the slot that is a member's tenth entry is free inside the order", async () => {
      await seedProfile(MEMBER);
      await seedEntries(MEMBER.id, 8);
      const outcome = await startOrder({
        userId: MEMBER.id,
        starts: [slot(3), slot(4), slot(5)],
        details: details({ email: MEMBER.email }),
      });
      assert.equal(outcome.kind, "checkout");
      if (outcome.kind !== "checkout") return;
      assert.equal(outcome.totalCents, 2 * PRICE);
      const held = await slotsOf(outcome.orderId);
      assert.deepEqual(
        held.map((row) => [row.price_cents, row.loyalty_reward]),
        [
          [PRICE, null],
          [0, 1],
          [PRICE, null],
        ],
      );
    });

    test("an order made only of rewards is confirmed without a payment", async () => {
      await seedProfile(MEMBER);
      await seedEntries(MEMBER.id, 9);
      const outcome = await startOrder({
        userId: MEMBER.id,
        starts: [slot(3)],
        details: details({ email: MEMBER.email }),
      });
      assert.equal(outcome.kind, "free");
      assert.equal(comgate.creates.length, 0);
      assert.equal((await orderRow(outcome.orderId)).status, "confirmed");
      const [row] = await slotsOf(outcome.orderId);
      assert.equal(row?.status, "confirmed");
      assert.equal(row?.loyalty_reward, 1);
    });

    test("one voucher discounts the whole order and the slot prices add up", async () => {
      await seedVoucher({
        code: "OBJEDNAVKA100",
        kind: "fixed_amount",
        value: 10_000,
      });
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4), slot(5)],
        details: details(),
        voucherCode: "objednavka100",
      });
      assert.equal(outcome.kind, "checkout");
      if (outcome.kind !== "checkout") return;
      assert.equal(outcome.totalCents, 3 * PRICE - 10_000);
      // The discount is spread in proportion, the remainder on the last slot:
      // each slot keeps the price a refund of it would return (VOP 8.9).
      const held = await slotsOf(outcome.orderId);
      assert.deepEqual(
        held.map((row) => row.price_cents),
        [19_567, 19_567, 19_566],
      );
      const claims = await rows<{ order_id: string; status: string }>(
        "select order_id, status from voucher_redemption",
      );
      assert.equal(claims.length, 1);
      assert.equal(claims[0]?.order_id, outcome.orderId);
      assert.equal(claims[0]?.status, "reserved");
      assert.ok((await orderRow(outcome.orderId)).voucher_id);

      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      const [claim] = await rows<{ status: string }>(
        "select status from voucher_redemption",
      );
      assert.equal(claim?.status, "redeemed");
    });

    test("a voucher covering everything confirms the order at once", async () => {
      await seedVoucher({ code: "ZDARMA100", kind: "percentage", value: 100 });
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
        voucherCode: "ZDARMA100",
      });
      assert.equal(outcome.kind, "free");
      assert.equal(comgate.creates.length, 0);
      const held = await slotsOf(outcome.orderId);
      assert.ok(
        held.every(
          (row) => row.status === "confirmed" && row.price_cents === 0,
        ),
      );
      const [claim] = await rows<{ status: string }>(
        "select status from voucher_redemption",
      );
      assert.equal(claim?.status, "redeemed");
    });

    test("a taken slot rejects the whole order and names the slot", async () => {
      const taken = await startBooking({
        userId: null,
        startsAt: slot(4),
        details: details({ email: "jiny@example.test" }),
      });
      assert.equal(taken.kind, "checkout");
      const before = await count("reservation");
      await assert.rejects(
        startOrder({
          userId: null,
          starts: [slot(3), slot(4)],
          details: details(),
        }),
        new RegExp(`Termín ${formatDateTime(slot(4))} už není volný`),
      );
      assert.equal(await count("reservation"), before);
      assert.equal(await count("booking_order"), 0);
    });

    test("more slots than allowed, or none, are refused", async () => {
      await assert.rejects(
        startOrder({ userId: null, starts: [], details: details() }),
        /alespoň jeden/,
      );
      await assert.rejects(
        startOrder({
          userId: null,
          starts: Array.from({ length: 11 }, (_, index) => slot(3 + index)),
          details: details(),
        }),
        /nejvýše 10/,
      );
    });

    test("a cancelled payment releases every slot of the order", async () => {
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      comgate.settle("TEST-0001", "CANCELLED");
      await synchronizeComgatePayment("TEST-0001");
      assert.equal((await orderRow(outcome.orderId)).status, "cancelled");
      assert.ok(
        (await slotsOf(outcome.orderId)).every(
          (row) => row.status === "cancelled",
        ),
      );
    });

    test("resubmitting the same selection continues the same checkout", async () => {
      const first = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      assert.equal(first.kind, "checkout");
      if (first.kind !== "checkout") return;
      const again = await startOrder({
        userId: null,
        starts: [slot(4), slot(3)],
        details: details(),
        hold: { kind: "order", id: first.orderId, token: first.token! },
      });
      assert.equal(again.kind, "checkout");
      if (again.kind === "checkout") assert.equal(again.url, first.url);
      assert.equal(comgate.creates.length, 1);
      assert.equal(await count("reservation"), 2);
    });

    test("a checkout whose gateway session is still open cannot be replaced", async () => {
      const first = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      if (first.kind !== "checkout") return assert.fail("expected checkout");
      const hold = {
        kind: "order" as const,
        id: first.orderId,
        token: first.token!,
      };
      // Paying the old tab after a replacement would charge twice.
      await assert.rejects(
        startOrder({
          userId: null,
          starts: [slot(3), slot(4), slot(5)],
          details: details(),
          hold,
        }),
        /otevřenou platbu/,
      );
      assert.equal((await orderRow(first.orderId)).status, "pending");
      assert.equal(comgate.creates.length, 1);

      // Once the gateway ends that session, the new selection goes through.
      comgate.settle("TEST-0001", "CANCELLED");
      const changed = await startOrder({
        userId: null,
        starts: [slot(3), slot(4), slot(5)],
        details: details(),
        hold,
      });
      assert.equal(changed.kind, "checkout");
      assert.equal((await orderRow(first.orderId)).status, "cancelled");
    });

    test("an e-mail alone never releases or reveals someone else's checkout", async () => {
      const victim = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      if (victim.kind !== "checkout") return assert.fail("expected checkout");
      await seedVoucher({ code: "CIZI10", kind: "percentage", value: 10 });
      // Same e-mail, no cookie, a different selection and a voucher: exactly
      // what used to release the victim's hold.
      await assert.rejects(
        startOrder({
          userId: null,
          starts: [slot(3), slot(5)],
          details: details(),
          voucherCode: "CIZI10",
        }),
        /rozpracovaný v jiné platbě/,
      );
      assert.equal((await orderRow(victim.orderId)).status, "pending");
      assert.ok(
        (await slotsOf(victim.orderId)).every(
          (row) => row.status === "pending",
        ),
      );
    });

    test("a payment for an order that was cancelled meanwhile alerts the operator", async () => {
      const recipients = "provoz@example.test";
      const [current] = await rows<{ value: { events: unknown } }>(
        "select value from site_setting where key = 'notifications.operator'",
      );
      await setSetting("notifications.operator", {
        recipients,
        events: current?.value.events,
      });
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      // The operator closes one of the held slots; the order cannot be
      // confirmed as a whole any more, so none of it stays held.
      const [first] = await slotsOf(outcome.orderId);
      await cancelReservation({ id: first!.id, reason: "Úklid" });
      assert.equal((await orderRow(outcome.orderId)).status, "cancelled");
      assert.ok(
        (await slotsOf(outcome.orderId)).every(
          (row) => row.status === "cancelled",
        ),
      );
      // The customer still pays in the open gateway tab.
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      const [alert] = await rows<{ notified_at: Date | null }>(
        "select notified_at from system_alert where dedupe_key like 'late-payment:%'",
      );
      assert.ok(alert?.notified_at, "the late payment alert was delivered");
      assert.equal(
        resend.sent.filter(
          (mail) =>
            mail.to === recipients && /objednávce/.test(mail.text ?? ""),
        ).length,
        1,
      );
    });

    test("a confirmation that could not be e-mailed is retried until it is sent", async () => {
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      resend.rateLimitNext(50);
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      const [first] = await slotsOf(outcome.orderId);
      const [step] = await rows<{ status: string }>(
        "select status from reservation_pipeline where reservation_id = $1 and step = 'payment'",
        [first!.id],
      );
      assert.equal(step?.status, "retrying");
      resend.rateLimitNext(0);
      await fulfillReservation(first!.id);
      const [done] = await rows<{ status: string }>(
        "select status from reservation_pipeline where reservation_id = $1 and step = 'payment'",
        [first!.id],
      );
      assert.equal(done?.status, "succeeded");
      assert.equal(
        resend.sent.filter((mail) =>
          mail.subject.startsWith("Potvrzení objednávky"),
        ).length,
        1,
      );
    });

    test("an order that never reached the gateway expires as a whole", async () => {
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      await rows("update payment set status = 'failed'");
      await rows(
        "update reservation set created_at = now() - interval '40 minutes' where order_id = $1",
        [outcome.orderId],
      );
      assert.equal(await releaseExpiredPendingReservations(), 2);
      const order = await orderRow(outcome.orderId);
      assert.equal(order.status, "cancelled");
      assert.equal(order.cancel_reason, "checkout_expired");
    });

    test("cancelling one paid slot asks for a refund of that slot's price only", async () => {
      const outcome = await startOrder({
        userId: null,
        starts: [slot(3), slot(4)],
        details: details(),
      });
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      const [first] = await slotsOf(outcome.orderId);
      await cancelReservation({ id: first!.id, reason: "test" });
      const [, second] = await slotsOf(outcome.orderId);
      const [alert] = await rows<{
        body: string;
        context: { amountCents: number };
      }>("select body, context from system_alert where dedupe_key = $1", [
        `refund-needed:${first!.id}`,
      ]);
      assert.equal(alert?.context.amountCents, PRICE);
      assert.match(alert?.body ?? "", /součást objednávky/);
      assert.equal(second?.status, "confirmed");
    });

    test("the account groups an order's slots and the administration labels them", async () => {
      await seedProfile(MEMBER);
      const order = await startOrder({
        userId: MEMBER.id,
        starts: [slot(3), slot(4)],
        details: details({ email: MEMBER.email }),
      });
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      await startBooking({
        userId: MEMBER.id,
        startsAt: slot(6),
        details: details({ email: MEMBER.email }),
      });

      const purchases = await listCustomerOrders(MEMBER.id, 1);
      assert.equal(purchases.length, 2);
      const grouped = purchases.find((row) => row.orderId === order.orderId);
      assert.ok(grouped);
      assert.equal(grouped.slots.length, 2);
      assert.equal(grouped.totalCents, 2 * PRICE);
      assert.equal(grouped.paymentStatus, "succeeded");
      const single = purchases.find((row) => row.orderId === null);
      assert.equal(single?.slots.length, 1);
      assert.equal(single?.paymentStatus, "pending");

      const history = await listHistoryForUser(MEMBER.id);
      const ofOrder = history.filter((row) => row.orderId === order.orderId);
      assert.equal(ofOrder.length, 2);
      assert.ok(
        ofOrder.every(
          (row) => row.orderSlots === 2 && row.paymentStatus === "succeeded",
        ),
      );
    });
  },
);
