/**
 * A member's one change of term (VOP 8.1–8.5) end to end against a local
 * Postgres: only the owner may move a paid booking, only once, only until
 * 24 hours before it starts, only to a free and open slot; the old time is
 * released and the customer holds the new time in writing, with a calendar
 * file that replaces the original entry.
 */
import {
  comgate,
  databaseReady,
  resend,
  resetDatabase,
  rows,
  seedProfile,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { startOrder } from "../../src/lib/services/orders";
import { synchronizeComgatePayment } from "../../src/lib/services/payments";
import { rescheduleReservation } from "../../src/lib/services/rescheduling";
import { retryRescheduleConfirmations } from "../../src/lib/services/reschedule-delivery";
import {
  CUSTOMER_CANCEL_REASON,
  cancelByCustomer,
} from "../../src/lib/services/reservations";
import { checkAvailability } from "../../src/lib/services/availability";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const MEMBER = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "zmena@example.test",
  fullName: "Zuzana Změnová",
};
const STRANGER = "55555555-5555-4555-8555-555555555555";
const TODAY = dateKeyInTimeZone(new Date());

function slot(daysAhead: number, minute = 10 * 60): Date {
  return localDateTimeToDate(addDaysToDateKey(TODAY, daysAhead), minute);
}

/** A paid, confirmed booking of the member, as the booking flow makes it. */
async function paidBooking(startsAt: Date): Promise<string> {
  await seedProfile(MEMBER);
  const outcome = await startOrder({
    userId: MEMBER.id,
    starts: [startsAt],
    details: {
      name: MEMBER.fullName,
      email: MEMBER.email,
      phone: "+420777000444",
      acceptedAt: new Date(),
    },
  });
  if (outcome.kind !== "checkout") throw new Error("expected a checkout");
  comgate.settle("TEST-0001", "PAID");
  await synchronizeComgatePayment("TEST-0001");
  const [row] = await rows<{ id: string; status: string }>(
    "select id, status from reservation where order_id = $1",
    [outcome.orderId],
  );
  assert.equal(row?.status, "confirmed");
  resend.sent.length = 0;
  return row!.id;
}

async function startsOf(id: string): Promise<number> {
  const [row] = await rows<{ starts_at: Date }>(
    "select starts_at from reservation where id = $1",
    [id],
  );
  return row!.starts_at.getTime();
}

describe(
  "rescheduling",
  { skip: !databaseReady && "needs a local TEST_DATABASE_URL" },
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

    test("the owner moves a paid booking once; the old time is free and the change is in writing", async () => {
      const id = await paidBooking(slot(5));
      const moved = await rescheduleReservation({
        reservationId: id,
        userId: MEMBER.id,
        startsAt: slot(6),
      });
      assert.equal(moved.startsAt.getTime(), slot(6).getTime());
      assert.equal(await startsOf(id), slot(6).getTime());
      const history = await rows(
        "select * from reservation_reschedule where reservation_id = $1",
        [id],
      );
      assert.equal(history.length, 1);
      const old = await checkAvailability(
        slot(5),
        new Date(slot(5).getTime() + 75 * 60_000),
      );
      assert.equal(old.available, true, "the original time is released");

      const mail = resend.sent.find((m) => m.to === MEMBER.email);
      assert.ok(mail, "the customer receives the change");
      assert.match(mail.subject, /Změna termínu/);
      const ics = Buffer.from(mail.attachments![0]!.content, "base64").toString(
        "utf8",
      );
      assert.match(ics, /\r\nSEQUENCE:1\r\n/);
      assert.match(ics, new RegExp(`UID:${id}@`));

      // One change only (VOP 8.1).
      await assert.rejects(
        rescheduleReservation({
          reservationId: id,
          userId: MEMBER.id,
          startsAt: slot(7),
        }),
        { message: "Tuto rezervaci už jste jednou změnili." },
      );
      assert.equal(await startsOf(id), slot(6).getTime());
    });

    test("a refused change email is retried once with the same calendar event", async () => {
      const id = await paidBooking(slot(5));
      resend.rateLimitNext(2);
      await rescheduleReservation({
        reservationId: id,
        userId: MEMBER.id,
        startsAt: slot(6),
      });
      const [failed] = await rows<{
        id: string;
        status: string;
        provider_response: unknown;
      }>(
        "select id, status, provider_response from message_delivery where dedupe_key = $1",
        [`reschedule-confirmation/${id}`],
      );
      assert.equal(failed?.status, "failed");
      assert.ok(failed?.provider_response, "the exact payload is durable");
      assert.equal(
        resend.sent.filter((mail) => mail.to === MEMBER.email).length,
        0,
      );
      await rows(
        "update message_delivery set updated_at = now() - interval '6 minutes' where id = $1",
        [failed!.id],
      );
      assert.equal(await retryRescheduleConfirmations(), 1);
      const [sent] = await rows<{ status: string; provider_response: unknown }>(
        "select status, provider_response from message_delivery where id = $1",
        [failed!.id],
      );
      assert.equal(sent?.status, "sent");
      assert.equal(sent?.provider_response, null);
      const mails = resend.sent.filter((mail) => mail.to === MEMBER.email);
      assert.equal(mails.length, 1);
      const ics = Buffer.from(
        mails[0]!.attachments![0]!.content,
        "base64",
      ).toString("utf8");
      assert.match(ics, new RegExp(`UID:${id}@`));
      assert.match(ics, /\r\nSEQUENCE:1\r\n/);
      assert.equal(await retryRescheduleConfirmations(), 0);
    });

    test("a crash after Resend acceptance repeats the same intent without a second email", async () => {
      const id = await paidBooking(slot(5));
      await rows(`create function test_reschedule_write_crash() returns trigger language plpgsql as $$
        begin raise exception 'local reschedule write crash'; end; $$`);
      await rows(`create trigger test_reschedule_write_crash before update of status on message_delivery
        for each row when (old.dedupe_key like 'reschedule-confirmation/%' and new.status = 'sent')
        execute function test_reschedule_write_crash()`);
      try {
        await rescheduleReservation({
          reservationId: id,
          userId: MEMBER.id,
          startsAt: slot(6),
        });
      } finally {
        await rows(
          "drop trigger if exists test_reschedule_write_crash on message_delivery",
        );
        await rows("drop function if exists test_reschedule_write_crash()");
      }
      const [pending] = await rows<{
        id: string;
        status: string;
        provider_response: unknown;
      }>(
        "select id, status, provider_response from message_delivery where dedupe_key = $1",
        [`reschedule-confirmation/${id}`],
      );
      assert.equal(pending?.status, "queued");
      assert.ok(pending?.provider_response);
      assert.equal(
        resend.sent.filter((mail) => mail.to === MEMBER.email).length,
        1,
      );
      await rows(
        "update message_delivery set updated_at = now() - interval '6 minutes' where id = $1",
        [pending!.id],
      );
      assert.equal(await retryRescheduleConfirmations(), 1);
      const [recovered] = await rows<{ status: string }>(
        "select status from message_delivery where id = $1",
        [pending!.id],
      );
      assert.equal(recovered?.status, "sent");
      assert.equal(
        resend.sent.filter((mail) => mail.to === MEMBER.email).length,
        1,
      );
    });

    test("someone else's booking cannot be moved, nor its existence revealed", async () => {
      const id = await paidBooking(slot(5));
      await assert.rejects(
        rescheduleReservation({
          reservationId: id,
          userId: STRANGER,
          startsAt: slot(6),
        }),
        { message: "Rezervaci se nepodařilo najít." },
      );
      assert.equal(await startsOf(id), slot(5).getTime());
    });

    test("less than 24 hours before the start the term can no longer change", async () => {
      const id = await paidBooking(slot(5));
      const now = new Date(slot(5).getTime() - 23 * 3_600_000);
      await assert.rejects(
        rescheduleReservation({
          reservationId: id,
          userId: MEMBER.id,
          startsAt: slot(6),
          now,
        }),
        {
          message: "Termín lze změnit nejpozději 24 hodin před jeho začátkem.",
        },
      );
      // Exactly 24 hours before is still in time.
      const moved = await rescheduleReservation({
        reservationId: id,
        userId: MEMBER.id,
        startsAt: slot(6),
        now: new Date(slot(5).getTime() - 24 * 3_600_000),
      });
      assert.equal(moved.startsAt.getTime(), slot(6).getTime());
    });

    test("a taken or blocked target is refused and nothing moves", async () => {
      const id = await paidBooking(slot(5));
      await rows(
        `insert into reservation (starts_at, ends_at, status, contact_email)
         values ($1, $2, 'confirmed', 'jiny@example.test')`,
        [slot(6), new Date(slot(6).getTime() + 75 * 60_000)],
      );
      await assert.rejects(
        rescheduleReservation({
          reservationId: id,
          userId: MEMBER.id,
          startsAt: slot(6),
        }),
        /jiný zákazník/,
      );
      await rows(
        "insert into blocked_slot (starts_at, ends_at, reason) values ($1, $2, 'maintenance')",
        [slot(7), new Date(slot(7).getTime() + 75 * 60_000)],
      );
      await assert.rejects(
        rescheduleReservation({
          reservationId: id,
          userId: MEMBER.id,
          startsAt: slot(7),
        }),
        { message: "Tento termín není k dispozici." },
      );
      assert.equal(await startsOf(id), slot(5).getTime());
      assert.equal(
        (await rows("select * from reservation_reschedule")).length,
        0,
        "a refused change does not use up the one allowed change",
      );
    });

    test("the customer's own storno frees the slot, refunds nothing and is logged", async () => {
      const id = await paidBooking(slot(5));
      await cancelByCustomer({ reservationId: id, userId: MEMBER.id });
      const [row] = await rows<{ status: string; cancel_reason: string }>(
        "select status, cancel_reason from reservation where id = $1",
        [id],
      );
      assert.equal(row?.status, "cancelled");
      assert.equal(row?.cancel_reason, CUSTOMER_CANCEL_REASON);
      const free = await checkAvailability(
        slot(5),
        new Date(slot(5).getTime() + 75 * 60_000),
      );
      assert.equal(free.available, true, "the slot is back in the calendar");
      assert.equal(
        (
          await rows(
            "select * from system_alert where dedupe_key like 'refund-needed:%'",
          )
        ).length,
        0,
        "no refund is due, so none is requested",
      );
      assert.equal(
        resend.sent.filter((mail) => mail.to === MEMBER.email).length,
        0,
        "no 'your booking was cancelled' e-mail for the customer's own storno",
      );
      const log = await rows<{ actor_type: string; summary: string }>(
        "select actor_type, summary from activity_log where reservation_id = $1 and action = 'reservation.cancelled'",
        [id],
      );
      assert.equal(log.length, 1);
      assert.equal(log[0]?.actor_type, "customer");
      assert.match(log[0]!.summary, /Zákazník zrušil rezervaci/);
      assert.match(log[0]!.summary, /nevrací/);
    });

    test("a storno is refused for someone else's, a cancelled or a started booking", async () => {
      const id = await paidBooking(slot(5));
      await assert.rejects(
        cancelByCustomer({ reservationId: id, userId: STRANGER }),
        { message: "Rezervaci se nepodařilo najít." },
      );
      await assert.rejects(
        cancelByCustomer({
          reservationId: id,
          userId: MEMBER.id,
          now: new Date(slot(5).getTime() + 60_000),
        }),
        { message: "Probíhající nebo uplynulý termín už nelze zrušit." },
      );
      await cancelByCustomer({ reservationId: id, userId: MEMBER.id });
      await assert.rejects(
        cancelByCustomer({ reservationId: id, userId: MEMBER.id }),
        { message: "Zrušit lze pouze potvrzenou rezervaci." },
      );
    });
  },
);
