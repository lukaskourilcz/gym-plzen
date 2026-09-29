/**
 * The booking flow end to end against a real (local) Postgres, with Resend
 * and Comgate replaced by recording stand-ins: what a guest and a member go
 * through from the details form to a confirmed reservation, what is written
 * on the way (reservation, payment, voucher claim, pipeline, deliveries) and
 * what the customer receives.
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
import { receiveAction } from "../../src/lib/helpers/action-response";
import { ok } from "../../src/lib/helpers/result";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  findOwnReservation,
  getBookingConfirmation,
  startBooking,
} from "../../src/lib/services/booking";
import { checkAvailability } from "../../src/lib/services/availability";
import { listForReservation as activityFor } from "../../src/lib/services/activity";
import { getEntryPriceCents } from "../../src/lib/services/loyalty";
import { synchronizeComgatePayment } from "../../src/lib/services/payments";
import { releaseExpiredPendingReservations } from "../../src/lib/services/reservations";
import { cancelReservation } from "../../src/lib/services/reservations";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
import { hashCode } from "../../src/lib/helpers/crypto";

const MEMBER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "clenka@example.test",
  fullName: "Klára Testová",
  phone: "+420777000111",
};
const GUEST = {
  name: "Tereza Hostová",
  email: "Tereza.Hostova@example.test",
  phone: "+420722000222",
};
const VOUCHER = "TESTNAVI5555X";
const CONSENT = new Date();

/** A bookable slot `daysAhead` from today at a Prague wall-clock minute. */
function slot(daysAhead: number, minute = 10 * 60): Date {
  return localDateTimeToDate(
    addDaysToDateKey(dateKeyInTimeZone(new Date()), daysAhead),
    minute,
  );
}

function guestDetails(overrides: Partial<typeof GUEST> = {}) {
  const details = { ...GUEST, ...overrides };
  return {
    name: details.name,
    email: details.email,
    phone: details.phone,
    acceptedAt: CONSENT,
  };
}

async function reservationRow(id: string) {
  const [row] = await rows<{
    status: string;
    price_cents: number | null;
    user_id: string | null;
    contact_email: string | null;
    cancel_reason: string | null;
    loyalty_reward: number | null;
    starts_at: Date;
  }>("select * from reservation where id = $1", [id]);
  assert.ok(row, `reservation ${id} exists`);
  return row;
}

async function reservationCount(): Promise<number> {
  const [row] = await rows<{ count: string }>(
    "select count(*)::text as count from reservation",
  );
  return Number(row?.count ?? 0);
}

describe(
  "booking flow",
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
      await seedVoucher({ code: VOUCHER, kind: "percentage", value: 100 });
    });

    test("a guest with a 100% voucher gets a confirmed entry and the confirmation e-mail", async () => {
      const startsAt = slot(7);
      const outcome = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
        voucherCode: "testnavi5555x",
      });
      assert.equal(outcome.kind, "free");
      assert.ok(outcome.token, "a guest receives the confirmation token");

      const row = await reservationRow(outcome.reservationId);
      assert.equal(row.status, "confirmed");
      assert.equal(row.price_cents, 0);
      assert.equal(row.user_id, null);
      assert.equal(row.contact_email, GUEST.email);
      assert.equal(row.loyalty_reward, null);

      const [claim] = await rows<{ status: string; final_price_cents: number }>(
        "select status, final_price_cents from voucher_redemption where reservation_id = $1",
        [outcome.reservationId],
      );
      assert.equal(claim?.status, "redeemed");
      assert.equal(claim?.final_price_cents, 0);

      // The lock is off: the payment step is done, the code steps wait for it.
      const pipeline = await rows<{ step: string; status: string }>(
        "select step, status from reservation_pipeline where reservation_id = $1 order by step",
        [outcome.reservationId],
      );
      assert.deepEqual(
        [...pipeline],
        [
          { step: "payment", status: "succeeded" },
          { step: "code_created", status: "pending" },
          { step: "code_delivered", status: "pending" },
        ],
      );

      // One confirmation, recorded as sent, and what it actually said.
      const deliveries = await rows<{
        kind: string;
        status: string;
        recipient: string;
      }>(
        "select kind, status, recipient from message_delivery where reservation_id = $1",
        [outcome.reservationId],
      );
      assert.deepEqual(
        [...deliveries],
        [
          {
            kind: "reservation_confirmation",
            status: "sent",
            recipient: GUEST.email,
          },
        ],
      );
      assert.equal(resend.sent.length, 1);
      const mail = resend.sent[0]!;
      assert.equal(mail.to, GUEST.email);
      assert.equal(mail.subject, "Potvrzení rezervace | NAVI Private Gym");
      assert.match(mail.text ?? "", /Ahoj Tereza Hostová/);
      assert.match(mail.text ?? "", /Cena: zdarma \(voucher\)/);
      assert.doesNotMatch(mail.text ?? "", /věrnostní/);
      assert.equal(mail.attachments?.[0]?.filename, "rezervace.ics");
      assert.match(
        Buffer.from(mail.attachments![0]!.content, "base64").toString("utf8"),
        /BEGIN:VCALENDAR/,
      );

      // The administration's history knows what happened and who did it.
      const log = await activityFor(outcome.reservationId);
      assert.deepEqual(
        log.map((entry) => [entry.action, entry.actorType, entry.actorLabel]),
        [["reservation.confirmed", "customer", GUEST.email]],
      );
      assert.match(log[0]!.summary, /voucher TESTNAVI5555X pokryl celou cenu/);

      // The token, and only the token, opens the confirmation for a guest.
      const confirmation = await getBookingConfirmation({
        userId: null,
        reservationId: outcome.reservationId,
        token: outcome.token,
      });
      assert.equal(confirmation.state, "confirmed");
      const stranger = await getBookingConfirmation({
        userId: null,
        reservationId: outcome.reservationId,
        token: "0".repeat(64),
      });
      assert.equal(stranger.state, "invalid");
    });

    test("a lost confirmation response retries identical mail after the template changes", async () => {
      resend.loseNextAcceptedResponse();
      const outcome = await startBooking({
        userId: null,
        startsAt: slot(7),
        details: guestDetails(),
        voucherCode: VOUCHER,
      });
      assert.equal(outcome.kind, "free");
      assert.equal(resend.sent.length, 1);
      const original = resend.sent[0]!;
      await setSetting("messages.email.reservation_confirmation", {
        subject: "Nová šablona",
        body: "Změněný obsah {time}",
      });
      await fulfillReservation(outcome.reservationId);
      assert.equal(resend.sent.length, 1, "provider accepted only one email");
      assert.equal(resend.sent[0], original);
      const [delivery] = await rows<{ status: string; n: string }>(
        "select status, count(*) over ()::text as n from message_delivery where reservation_id = $1 and kind = 'reservation_confirmation'",
        [outcome.reservationId],
      );
      assert.equal(delivery?.status, "sent");
      assert.equal(delivery?.n, "1");
    });

    test("customer storno consumes a redeemed voucher, operator storno restores it", async () => {
      const customer = await startBooking({
        userId: null,
        startsAt: slot(7),
        details: guestDetails(),
        voucherCode: VOUCHER,
      });
      await cancelReservation({ id: customer.reservationId, byCustomer: true });
      const [consumed] = await rows<{ status: string }>(
        "select status from voucher_redemption where reservation_id = $1",
        [customer.reservationId],
      );
      assert.equal(consumed?.status, "redeemed");

      const operator = await startBooking({
        userId: null,
        startsAt: slot(8),
        details: guestDetails(),
        voucherCode: VOUCHER,
      });
      await cancelReservation({
        id: operator.reservationId,
        byAdminId: MEMBER.id,
      });
      const [restored] = await rows<{ status: string }>(
        "select status from voucher_redemption where reservation_id = $1",
        [operator.reservationId],
      );
      assert.equal(restored?.status, "released");
    });

    test("a member with a 100% voucher gets a confirmed entry that counts towards loyalty", async () => {
      await seedProfile(MEMBER);
      const startsAt = slot(8);
      const outcome = await startBooking({
        userId: MEMBER.id,
        startsAt,
        details: guestDetails({ email: MEMBER.email, name: MEMBER.fullName }),
        voucherCode: VOUCHER,
      });
      assert.equal(outcome.kind, "free");
      const row = await reservationRow(outcome.reservationId);
      assert.equal(row.status, "confirmed");
      assert.equal(row.user_id, MEMBER.id);
      assert.equal(row.price_cents, 0);

      const confirmation = await getBookingConfirmation({
        userId: MEMBER.id,
        reservationId: outcome.reservationId,
      });
      assert.equal(confirmation.state, "confirmed");
      assert.equal(resend.sent.length, 1);
      assert.match(
        resend.sent[0]!.text ?? "",
        /Toto je váš 1\. započítaný vstup/,
      );
    });

    test("a member's tenth entry is free without any voucher", async () => {
      await seedProfile(MEMBER);
      for (let index = 1; index <= 9; index += 1) {
        const past = localDateTimeToDate(
          addDaysToDateKey(dateKeyInTimeZone(new Date()), -index),
          10 * 60,
        );
        await rows(
          `insert into reservation (user_id, starts_at, ends_at, status, price_cents)
         values ($1, $2, $3, 'completed', 22900)`,
          [MEMBER.id, past, new Date(past.getTime() + 75 * 60_000)],
        );
      }
      const outcome = await startBooking({
        userId: MEMBER.id,
        startsAt: slot(9),
        details: guestDetails({ email: MEMBER.email, name: MEMBER.fullName }),
      });
      assert.equal(outcome.kind, "free");
      const row = await reservationRow(outcome.reservationId);
      assert.equal(row.loyalty_reward, 1);
      assert.equal(row.price_cents, 0);
      assert.match(resend.sent[0]!.text ?? "", /zdarma \(věrnostní vstup\)/);
      assert.equal(comgate.creates.length, 0);
    });

    test("a paid booking holds the slot and sends the guest to the gateway once", async () => {
      const startsAt = slot(10);
      const expectedPrice = await getEntryPriceCents(startsAt);
      const outcome = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
      });
      assert.equal(outcome.kind, "checkout");
      if (outcome.kind !== "checkout") return;
      assert.match(outcome.url, /^https:\/\/payments\.comgate\.cz\//);
      assert.equal(outcome.priceCents, expectedPrice);
      assert.ok(outcome.token, "the guest gets the key to their hold");

      const row = await reservationRow(outcome.reservationId);
      assert.equal(row.status, "pending");
      assert.equal(row.price_cents, expectedPrice);
      const [attempt] = await rows<{
        status: string;
        provider_payment_id: string;
        amount_cents: number;
      }>("select * from payment where reservation_id = $1", [
        outcome.reservationId,
      ]);
      assert.equal(attempt?.status, "pending");
      assert.equal(attempt?.provider_payment_id, "TEST-0001");
      assert.equal(comgate.creates.length, 1);
      assert.equal(
        (comgate.creates[0] as { price: number }).price,
        expectedPrice,
      );
      // Nothing is confirmed and nothing is mailed before the money is in.
      assert.equal(resend.sent.length, 0);

      // The slot is now taken for everyone else.
      await assert.rejects(
        startBooking({
          userId: null,
          startsAt,
          details: guestDetails({ email: "jiny@example.test" }),
        }),
        { message: "Tento termín je již rezervovaný." },
      );
      assert.equal(await reservationCount(), 1);

      // The same guest submitting again (a double click, the back button from
      // the gateway) continues the same checkout: same gateway session, no
      // second reservation, no second charge attempt.
      const again = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails({ email: GUEST.email.toUpperCase() }),
      });
      assert.equal(again.kind, "checkout");
      if (again.kind === "checkout") assert.equal(again.url, outcome.url);
      assert.equal(await reservationCount(), 1);
      assert.equal(comgate.creates.length, 1);

      // With the hold cookie the proof is the token rather than the e-mail.
      const withCookie = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails({ email: "typo@example.test" }),
        hold: {
          kind: "reservation",
          id: outcome.reservationId,
          token: outcome.token!,
        },
      });
      assert.equal(withCookie.kind, "checkout");
      if (withCookie.kind === "checkout") {
        assert.equal(withCookie.url, outcome.url);
        assert.equal(withCookie.token, outcome.token);
      }
      assert.equal(await reservationCount(), 1);

      // A cookie that names the reservation without its token proves nothing.
      await assert.rejects(
        startBooking({
          userId: null,
          startsAt,
          details: guestDetails({ email: "typo@example.test" }),
          hold: {
            kind: "reservation",
            id: outcome.reservationId,
            token: "f".repeat(64),
          },
        }),
        { message: "Tento termín je již rezervovaný." },
      );
    });

    for (const member of [false, true]) {
      test(`a lost checkout response can be retried without a second booking or payment (${member ? "member" : "guest without cookie"})`, async () => {
        if (member) await seedProfile(MEMBER);
        const input = {
          userId: member ? MEMBER.id : null,
          startsAt: slot(10),
          details: guestDetails(),
        };
        let original: Awaited<ReturnType<typeof startBooking>> | undefined;
        const lost = await receiveAction(async () => {
          original = await startBooking(input);
          // No result (including the hold token/cookie) reaches the browser.
          throw new TypeError("Load failed");
        });
        assert.equal(lost.received, false);
        assert.equal(original?.kind, "checkout");
        const retry = await receiveAction(async () =>
          ok(await startBooking(input)),
        );
        if (!retry.received || !retry.result.ok) assert.fail("retry failed");
        const recovered = retry.result.data;
        assert.equal(recovered.reservationId, original?.reservationId);
        assert.equal(recovered.kind, "checkout");
        if (recovered.kind === "checkout" && original?.kind === "checkout")
          assert.equal(recovered.url, original.url);
        assert.equal(await reservationCount(), 1);
        assert.equal(comgate.creates.length, 1);
        assert.equal(resend.sent.length, 0);
      });
    }

    test("the gateway settling the payment confirms the booking and a repeat submit says so", async () => {
      const startsAt = slot(11);
      const outcome = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
      });
      assert.equal(outcome.kind, "checkout");
      comgate.settle("TEST-0001", "PAID");
      assert.equal(await synchronizeComgatePayment("TEST-0001"), true);
      assert.deepEqual(
        (await activityFor(outcome.reservationId)).map((entry) => [
          entry.action,
          entry.actorType,
        ]),
        [
          ["reservation.created", "customer"],
          ["reservation.confirmed", "system"],
        ],
      );

      const row = await reservationRow(outcome.reservationId);
      assert.equal(row.status, "confirmed");
      const [attempt] = await rows<{ status: string; paid_at: Date | null }>(
        "select status, paid_at from payment where reservation_id = $1",
        [outcome.reservationId],
      );
      assert.equal(attempt?.status, "succeeded");
      assert.ok(attempt?.paid_at);
      assert.equal(resend.sent.length, 1);
      assert.match(resend.sent[0]!.text ?? "", /Cena: 229\sKč/);

      // A second delivery of the same notification changes nothing.
      assert.equal(await synchronizeComgatePayment("TEST-0001"), true);
      assert.equal(resend.sent.length, 1);

      await assert.rejects(
        startBooking({ userId: null, startsAt, details: guestDetails() }),
        { message: /Tento termín už není volný/ },
      );
      const confirmation = await getBookingConfirmation({
        userId: null,
        reservationId: outcome.reservationId,
        token: outcome.token,
      });
      assert.equal(confirmation.state, "confirmed");
    });

    test("an abandoned gateway session frees the slot for the same guest and everyone else", async () => {
      const startsAt = slot(12);
      const first = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
      });
      assert.equal(first.kind, "checkout");
      comgate.settle("TEST-0001", "CANCELLED");

      // The next submit sees the cancellation before it decides anything.
      const second = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
      });
      assert.equal(second.kind, "checkout");
      assert.notEqual(second.reservationId, first.reservationId);
      const old = await reservationRow(first.reservationId);
      assert.equal(old.status, "cancelled");
      assert.equal(old.cancel_reason, "payment_cancelled");
      const log = await activityFor(first.reservationId);
      assert.equal(log.at(-1)?.action, "reservation.cancelled");
      assert.match(log.at(-1)?.summary ?? "", /Platba neproběhla/);
      assert.equal(comgate.creates.length, 2);
    });

    test("a voucher cannot replace a hold while its original gateway session is open", async () => {
      const startsAt = slot(13);
      const first = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
      });
      assert.equal(first.kind, "checkout");

      await assert.rejects(
        startBooking({
          userId: null,
          startsAt,
          details: guestDetails(),
          voucherCode: VOUCHER,
          hold: {
            kind: "reservation",
            id: first.reservationId,
            token: first.token!,
          },
        }),
        /otevřenou platbu/,
      );
      assert.equal(
        (await reservationRow(first.reservationId)).status,
        "pending",
      );
      assert.equal(comgate.creates.length, 1);

      comgate.settle("TEST-0001", "CANCELLED");

      const second = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
        voucherCode: VOUCHER,
        hold: {
          kind: "reservation",
          id: first.reservationId,
          token: first.token!,
        },
      });
      assert.equal(second.kind, "free");
      assert.notEqual(second.reservationId, first.reservationId);
      const old = await reservationRow(first.reservationId);
      assert.equal(old.status, "cancelled");
      assert.equal(old.cancel_reason, "payment_cancelled");
      const fresh = await reservationRow(second.reservationId);
      assert.equal(fresh.status, "confirmed");
      assert.equal(fresh.price_cents, 0);
    });

    test("email and a forged cookie never release another guest's legacy hold", async () => {
      const startsAt = slot(13);
      const victim = await startBooking({
        userId: null,
        startsAt,
        details: guestDetails(),
      });
      await rows("delete from payment where reservation_id = $1", [
        victim.reservationId,
      ]);
      for (const hold of [
        undefined,
        {
          kind: "reservation" as const,
          id: victim.reservationId,
          token: "0".repeat(64),
        },
      ]) {
        await assert.rejects(
          startBooking({
            userId: null,
            startsAt,
            details: guestDetails(),
            voucherCode: VOUCHER,
            hold,
          }),
          /rozpracovaný v jiné platbě/,
        );
        assert.equal(
          (await reservationRow(victim.reservationId)).status,
          "pending",
        );
      }
      assert.equal(await reservationCount(), 1);
    });

    test("a rejected voucher leaves no hold behind", async () => {
      const startsAt = slot(14);
      await assert.rejects(
        startBooking({
          userId: null,
          startsAt,
          details: guestDetails(),
          voucherCode: "NEEXISTUJE",
        }),
        { message: "Voucher není platný nebo už není aktivní." },
      );
      const [row] = await rows<{ status: string; cancel_reason: string }>(
        "select status, cancel_reason from reservation",
      );
      assert.equal(row?.status, "cancelled");
      assert.equal(row?.cancel_reason, "voucher_rejected");
      const free = await checkAvailability(
        startsAt,
        new Date(startsAt.getTime() + 75 * 60_000),
      );
      assert.equal(free.available, true);
      assert.equal(comgate.creates.length, 0);
    });

    test("with payments switched off nothing is reserved unless the entry is free", async () => {
      await setSetting("booking.operations", {
        paymentsEnabled: false,
        bookingsFrom: "",
        accessCodesEnabled: false,
      });
      await assert.rejects(
        startBooking({
          userId: null,
          startsAt: slot(15),
          details: guestDetails(),
        }),
        {
          message:
            "Online platby teď nejsou dostupné. Zkuste to prosím později.",
        },
      );
      // A voucher cannot open a side door: it is claimed after the check.
      await assert.rejects(
        startBooking({
          userId: null,
          startsAt: slot(15),
          details: guestDetails(),
          voucherCode: VOUCHER,
        }),
        {
          message:
            "Online platby teď nejsou dostupné. Zkuste to prosím později.",
        },
      );
      assert.equal(await reservationCount(), 0);
    });

    test("a blocked or past slot is refused before anything is written", async () => {
      const startsAt = slot(16);
      await rows(
        "insert into blocked_slot (starts_at, ends_at, reason) values ($1, $2, 'maintenance')",
        [startsAt, new Date(startsAt.getTime() + 75 * 60_000)],
      );
      await assert.rejects(
        startBooking({ userId: null, startsAt, details: guestDetails() }),
        { message: "Tento termín je blokovaný." },
      );
      await assert.rejects(
        startBooking({
          userId: null,
          startsAt: slot(-1),
          details: guestDetails(),
        }),
        { message: "Vybraný termín není dostupný pro rezervaci." },
      );
      assert.equal(await reservationCount(), 0);
    });

    test("a hold that never reached the gateway expires after the checkout window", async () => {
      const startsAt = slot(17);
      const [stale] = await rows<{ id: string }>(
        `insert into reservation (starts_at, ends_at, status, price_cents, contact_email, created_at)
       values ($1, $2, 'pending', 22900, $3, now() - interval '40 minutes') returning id`,
        [startsAt, new Date(startsAt.getTime() + 75 * 60_000), GUEST.email],
      );
      assert.equal(await releaseExpiredPendingReservations(), 1);
      const row = await reservationRow(stale!.id);
      assert.equal(row.status, "cancelled");
      assert.equal(row.cancel_reason, "checkout_expired");
      const log = await activityFor(stale!.id);
      assert.equal(log.length, 1);
      assert.equal(log[0]?.actorLabel, "Watchdog");
      assert.match(log[0]?.summary ?? "", /nebyla zahájena do 32 minut/);
    });

    test("own reservations are found by account, by e-mail and by hold cookie only", async () => {
      await seedProfile(MEMBER);
      const startsAt = slot(18);
      const token = "b".repeat(64);
      const [row] = await rows<{ id: string }>(
        `insert into reservation (user_id, starts_at, ends_at, status, price_cents, contact_email, confirmation_token_hash)
       values ($1, $2, $3, 'pending', 22900, $4, $5) returning id`,
        [
          MEMBER.id,
          startsAt,
          new Date(startsAt.getTime() + 75 * 60_000),
          MEMBER.email,
          hashCode(token),
        ],
      );
      const id = row!.id;
      assert.equal(
        (await findOwnReservation({ userId: MEMBER.id, email: null, startsAt }))
          ?.id,
        id,
      );
      // A member's reservation is theirs, not the e-mail's.
      assert.equal(
        await findOwnReservation({
          userId: null,
          email: MEMBER.email,
          startsAt,
        }),
        null,
      );
      assert.equal(
        (
          await findOwnReservation({
            userId: null,
            email: null,
            startsAt,
            hold: { kind: "reservation", id, token },
          })
        )?.id,
        id,
      );
      // The cookie is bound to the slot it was issued for.
      assert.equal(
        await findOwnReservation({
          userId: null,
          email: null,
          startsAt: slot(19),
          hold: { kind: "reservation", id, token },
        }),
        null,
      );
    });
  },
);
