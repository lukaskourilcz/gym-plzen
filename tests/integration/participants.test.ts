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
import assert from "node:assert/strict";
import { before, after, beforeEach, describe, test } from "node:test";
import {
  createReservation,
  getReservation,
  cancelReservation,
} from "../../src/lib/services/reservations";
import { addParticipants } from "../../src/lib/services/participants";
import { synchronizeComgatePayment } from "../../src/lib/services/payments";
import {
  startOrder,
  quoteOrder,
  resolveOrderSlots,
} from "../../src/lib/services/orders";
import { getEntryPriceCents } from "../../src/lib/services/loyalty";
import { saveBlockPrice } from "../../src/lib/services/block-pricing";
import { loadSiteContent } from "../../src/lib/content/site";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const MEMBER = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "doprovod@example.test",
  fullName: "Dana Doprovodová",
};
function slot(days = 5, minute = 600) {
  return localDateTimeToDate(
    addDaysToDateKey(dateKeyInTimeZone(new Date()), days),
    minute,
  );
}
async function existing(extraPeople = 0) {
  return createReservation({
    userId: MEMBER.id,
    startsAt: slot(),
    endsAt: new Date(slot().getTime() + 60 * 60_000),
    contactName: MEMBER.fullName,
    contactEmail: MEMBER.email,
    status: "confirmed",
    priceCents: 22_900,
    extraPeople,
  });
}
async function counts() {
  return rows(
    "select step, status, attempts, completed_at from reservation_pipeline order by step",
  );
}

describe(
  "block prices and participant additions",
  { skip: !databaseReady },
  () => {
    before(startProviders);
    after(stopEverything);
    beforeEach(async () => {
      await resetDatabase();
      await seedProfile(MEMBER);
    });
    test("block price overrides date price; public calendar and checkout agree", async () => {
      const at = slot();
      const adminId = MEMBER.id;
      await rows(
        "insert into pricing_period (name, price_cents, starts_at, ends_at) values ('Akce', 15000, $1, $2)",
        [slot(4), slot(7)],
      );
      await saveBlockPrice(
        {
          dayOfWeek: dayOfWeek(at),
          startMinute: 600,
          endMinute: 720,
          priceCents: 19_900,
        },
        adminId,
      );
      assert.equal(await getEntryPriceCents(at), 19_900);
      assert.equal((await loadSiteContent()).entryPriceForDate(at), 19_900);
      assert.equal(await getEntryPriceCents(slot(5, 720)), 15_000);
      await assert.rejects(
        saveBlockPrice(
          {
            dayOfWeek: dayOfWeek(at),
            startMinute: 660,
            endMinute: 780,
            priceCents: 17_900,
          },
          adminId,
        ),
        /už nastavená jiná cena/,
      );
      await assert.rejects(
        saveBlockPrice(
          {
            dayOfWeek: dayOfWeek(at),
            startMinute: 605,
            endMinute: 720,
            priceCents: 17_900,
          },
          adminId,
        ),
        /Rozvrh se změnil/,
      );
    });
    test("one save applies to all matching days atomically and skips different grids", async () => {
      await rows(
        "update opening_hours set open_minute = 30 where day_of_week = 0",
      );
      await saveBlockPrice(
        {
          dayOfWeek: 1,
          startMinute: 600,
          endMinute: 720,
          priceCents: 19900,
          applyToMatchingDays: true,
        },
        MEMBER.id,
      );
      const [saved] = await rows<{ value: { dayOfWeek: number }[] }>(
        "select value from site_setting where key = 'pricing.time_blocks'",
      );
      assert.equal(saved?.value.length, 6);
      assert.ok(saved?.value.every((rule) => rule.dayOfWeek !== 0));
      await assert.rejects(
        saveBlockPrice(
          {
            dayOfWeek: 1,
            startMinute: 660,
            endMinute: 780,
            priceCents: 24900,
            applyToMatchingDays: true,
          },
          MEMBER.id,
        ),
        /už nastavená jiná cena/,
      );
      assert.deepEqual(
        (
          await rows<{ value: unknown }>(
            "select value from site_setting where key = 'pricing.time_blocks'",
          )
        )[0]?.value,
        saved?.value,
      );
    });
    test("two slots include the flat group fee per block, and hold resumption cannot change people", async () => {
      const params = {
        userId: MEMBER.id,
        starts: [slot(), slot(6)],
        extraPeople: 2,
        details: {
          name: MEMBER.fullName,
          email: MEMBER.email,
          phone: "+420777000111",
          acceptedAt: new Date(),
        },
      };
      const quoted = await quoteOrder({
        userId: MEMBER.id,
        slots: await resolveOrderSlots(params.starts),
        extraPeople: 2,
      });
      assert.equal(quoted.totalCents, 65_800);
      const result = await startOrder(params);
      assert.equal(result.kind, "checkout");
      if (result.kind !== "checkout") return;
      assert.equal(result.totalCents, quoted.totalCents);
      assert.deepEqual(
        (
          await rows<{ extra_people: number; price_cents: number }>(
            "select extra_people, price_cents from reservation order by starts_at",
          )
        ).map((r) => [r.extra_people, r.price_cents]),
        [
          [2, 32_900],
          [2, 32_900],
        ],
      );
      await startOrder(params);
      assert.equal(comgate.creates.length, 1);
      await assert.rejects(
        startOrder({ ...params, extraPeople: 0 }),
        /otevřenou platbu/,
      );
      assert.equal(comgate.creates.length, 1);
    });
    test("the tenth base entry is free but its per-person surcharge still requires payment", async () => {
      await setSetting("pricing.additional_people", {
        amountCents: 10_000,
        mode: "per_person",
      });
      for (let i = 0; i < 9; i++)
        await rows(
          "insert into reservation (user_id, starts_at, ends_at, status, price_cents) values ($1, now() - ($2 || ' days')::interval, now() - ($2 || ' days')::interval + interval '60 minutes', 'completed', 22900)",
          [MEMBER.id, String(100 + i)],
        );
      const result = await startOrder({
        userId: MEMBER.id,
        starts: [slot()],
        extraPeople: 2,
        details: {
          name: MEMBER.fullName,
          email: MEMBER.email,
          phone: "+420777000111",
          acceptedAt: new Date(),
        },
      });
      assert.equal(result.kind, "checkout");
      if (result.kind !== "checkout") return;
      assert.equal(result.totalCents, 20_000);
      const [reward] = await rows<{
        loyalty_reward: number;
        extra_people: number;
      }>(
        "select loyalty_reward, extra_people from reservation where order_id = $1",
        [result.orderId],
      );
      assert.equal(reward?.loyalty_reward, 1);
      assert.equal(reward?.extra_people, 2);
    });
    test("successful supplemental payment changes only participants, once, with no e-mail or code pipeline", async () => {
      const booking = await existing();
      const before = await counts();
      const input = {
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 2,
        quotedCents: 10_000,
      };
      const [a, b] = await Promise.all([
        addParticipants(input),
        addParticipants(input),
      ]);
      assert.equal(a.kind, "checkout");
      assert.deepEqual(a, b);
      assert.equal(comgate.creates.length, 1);
      assert.equal((await getReservation(booking.id))?.extraPeople, 0);
      const [attempt] = await rows<{
        provider_payment_id: string;
        reservation_id: null;
        order_id: null;
        amount_cents: number;
      }>("select * from payment");
      assert.equal(attempt?.reservation_id, null);
      assert.equal(attempt?.order_id, null);
      assert.equal(attempt?.amount_cents, 10_000);
      comgate.settle(attempt!.provider_payment_id, "PAID");
      await Promise.all([
        synchronizeComgatePayment(attempt!.provider_payment_id),
        synchronizeComgatePayment(attempt!.provider_payment_id),
      ]);
      comgate.settle(attempt!.provider_payment_id, "CANCELLED");
      await synchronizeComgatePayment(attempt!.provider_payment_id);
      const after = (await getReservation(booking.id))!;
      assert.equal(after.extraPeople, 2);
      assert.equal(after.additionalPeoplePaidCents, 10_000);
      for (const field of [
        "startsAt",
        "endsAt",
        "status",
        "priceCents",
        "contactEmail",
        "confirmationTokenHash",
        "loyaltyReward",
      ] as const)
        assert.deepEqual(after[field], booking[field], field);
      assert.deepEqual(await counts(), before);
      assert.equal(resend.sent.length, 0);
      assert.equal(
        (
          await rows<{ n: number }>(
            "select count(*)::int as n from access_code",
          )
        )[0]?.n,
        0,
      );
    });
    test("a refused gateway creation leaves the original reservation intact", async () => {
      const booking = await existing();
      comgate.rejectNextCreation();
      await assert.rejects(
        addParticipants({
          userId: MEMBER.id,
          reservationId: booking.id,
          toCount: 1,
          quotedCents: 10000,
        }),
        /Původní rezervace zůstává platná/,
      );
      assert.deepEqual(await getReservation(booking.id), booking);
      assert.equal(
        (
          await rows<{ status: string }>(
            "select status from participant_addition",
          )
        )[0]?.status,
        "failed",
      );
      assert.equal(resend.sent.length, 0);
    });
    test("an unknown gateway response never creates another charge on retry", async () => {
      const booking = await existing();
      comgate.loseNextCreationResponse();
      const input = {
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 2,
        quotedCents: 10000,
      };
      const first = await addParticipants(input);
      assert.equal(first.kind, "processing");
      assert.deepEqual(await addParticipants(input), first);
      assert.equal(comgate.creates.length, 1);
      assert.deepEqual(await getReservation(booking.id), booking);
      assert.equal(
        (
          await rows<{ failure_reason: string }>(
            "select failure_reason from payment",
          )
        )[0]?.failure_reason,
        "creation_unknown",
      );
      assert.equal(resend.sent.length, 0);
    });
    test("a paid callback for a previously failed addition is flagged for review", async () => {
      const booking = await existing();
      await addParticipants({
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 1,
        quotedCents: 10000,
      });
      comgate.settle("TEST-0001", "CANCELLED");
      await synchronizeComgatePayment("TEST-0001");
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      assert.equal((await getReservation(booking.id))?.extraPeople, 0);
      assert.equal(
        (
          await rows<{ status: string }>(
            "select status from participant_addition",
          )
        )[0]?.status,
        "review_needed",
      );
      assert.equal(resend.sent.length, 0);
    });
    test("adding a second person to a flat paid group requires no new charge", async () => {
      const booking = await existing(1);
      const result = await addParticipants({
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 2,
        quotedCents: 0,
      });
      assert.equal(result.kind, "confirmed");
      assert.equal(comgate.creates.length, 0);
      assert.equal(resend.sent.length, 0);
      assert.equal((await getReservation(booking.id))?.extraPeople, 2);
      assert.equal((await getReservation(booking.id))?.priceCents, 22_900);
    });
    test("late additions use the current fee only for the new people", async () => {
      const booking = await existing(1);
      await setSetting("pricing.additional_people", {
        amountCents: 15_000,
        mode: "per_person",
      });
      await assert.rejects(
        addParticipants({
          userId: MEMBER.id,
          reservationId: booking.id,
          toCount: 2,
          quotedCents: 10_000,
        }),
        /Příplatek se změnil/,
      );
      assert.equal(comgate.creates.length, 0);
      await addParticipants({
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 2,
        quotedCents: 15_000,
      });
      assert.equal((comgate.creates[0] as { price: number }).price, 15_000);
      assert.equal((await getReservation(booking.id))?.extraPeople, 1);
    });
    test("cancelled supplemental payment leaves the original reservation valid and allows a new attempt", async () => {
      const booking = await existing();
      const input = {
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 1,
        quotedCents: 10_000,
      };
      await addParticipants(input);
      comgate.settle("TEST-0001", "CANCELLED");
      await synchronizeComgatePayment("TEST-0001");
      assert.equal((await getReservation(booking.id))?.status, "confirmed");
      assert.equal((await getReservation(booking.id))?.extraPeople, 0);
      await addParticipants(input);
      assert.equal(comgate.creates.length, 2);
      assert.equal(resend.sent.length, 0);
    });
    test("paid addition after cancellation does not resurrect or modify the original booking", async () => {
      const booking = await existing();
      await addParticipants({
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 1,
        quotedCents: 10_000,
      });
      await rows("update reservation set status = 'cancelled' where id = $1", [
        booking.id,
      ]);
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      assert.equal((await getReservation(booking.id))?.status, "cancelled");
      assert.equal((await getReservation(booking.id))?.extraPeople, 0);
      assert.equal(
        (
          await rows<{ status: string }>(
            "select status from participant_addition",
          )
        )[0]?.status,
        "review_needed",
      );
      assert.equal(
        (
          await rows<{ context: { amountCents: number } }>(
            "select context from system_alert where dedupe_key like 'refund-needed:participant:%'",
          )
        )[0]?.context.amountCents,
        10000,
      );
      assert.equal(resend.sent.length, 0);
    });
    test("ownership, limits, past visits and unfinished term changes are checked before charging", async () => {
      const booking = await existing();
      const input = {
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 1,
        quotedCents: 10_000,
      };
      await assert.rejects(
        addParticipants({
          ...input,
          userId: "44444444-4444-4444-8444-444444444444",
        }),
        /vlastní/,
      );
      for (const toCount of [-1, 3, 0.5])
        await assert.rejects(addParticipants({ ...input, toCount }));
      await rows(
        "update reservation set reschedule_starts_at = starts_at + interval '1 day', reschedule_ends_at = ends_at + interval '1 day' where id = $1",
        [booking.id],
      );
      await assert.rejects(addParticipants(input), /vlastní budoucí/);
      await rows(
        "update reservation set reschedule_starts_at = null, reschedule_ends_at = null, starts_at = now() - interval '1 day', ends_at = now() - interval '23 hours' where id = $1",
        [booking.id],
      );
      await assert.rejects(addParticipants(input), /vlastní budoucí/);
      assert.equal(comgate.creates.length, 0);
      assert.equal(resend.sent.length, 0);
    });
    test("operator cancellation includes successful companion payments in the refund alert", async () => {
      const booking = await existing();
      await addParticipants({
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 1,
        quotedCents: 10000,
      });
      comgate.settle("TEST-0001", "PAID");
      await synchronizeComgatePayment("TEST-0001");
      await cancelReservation({ id: booking.id, byAdminId: MEMBER.id });
      const [alert] = await rows<{
        context: { amountCents: number; companionPaymentIds: string[] };
      }>("select context from system_alert where dedupe_key = $1", [
        `refund-needed:${booking.id}`,
      ]);
      assert.equal(alert?.context.amountCents, 10000);
      assert.equal(alert?.context.companionPaymentIds.length, 1);
    });
    test("a wrong gateway amount never grants participants", async () => {
      const booking = await existing();
      await addParticipants({
        userId: MEMBER.id,
        reservationId: booking.id,
        toCount: 2,
        quotedCents: 10_000,
      });
      comgate.settle("TEST-0001", "PAID");
      comgate.payments.get("TEST-0001")!.price = 1;
      await assert.rejects(synchronizeComgatePayment("TEST-0001"), /mismatch/);
      assert.equal((await getReservation(booking.id))?.extraPeople, 0);
      assert.equal(resend.sent.length, 0);
    });
    test("new price settings never update existing reservations or send mail", async () => {
      const booking = await existing();
      await saveBlockPrice(
        {
          dayOfWeek: dayOfWeek(slot()),
          startMinute: 600,
          endMinute: 720,
          priceCents: 30_000,
        },
        MEMBER.id,
      );
      assert.deepEqual(await getReservation(booking.id), booking);
      assert.equal(resend.sent.length, 0);
      // A changed grid deactivates the stale range, never silently shifts it.
      await rows(
        "update opening_hours set open_minute=30 where day_of_week=$1",
        [dayOfWeek(slot())],
      );
      assert.equal(await getEntryPriceCents(slot()), 22_900);
    });
  },
);
