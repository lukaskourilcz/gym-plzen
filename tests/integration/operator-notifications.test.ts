/**
 * What the people who run the gym are told, against a real (local) Postgres
 * with Resend replaced by a recording stand-in: which events reach them, what
 * the e-mail says, and that a retried fulfillment run cannot send it twice.
 *
 *   npm run test:integration        # needs DATABASE_URL to a local Postgres
 */
import {
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
import { startBooking } from "../../src/lib/services/booking";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import {
  cancelReservation,
  getReservation,
} from "../../src/lib/services/reservations";
import {
  deliverPendingAlerts,
  raiseAlert,
} from "../../src/lib/services/alerts";
import {
  getOperatorNotifications,
  notifyReservationRescheduled,
  retryPendingOperatorNotices,
  saveOperatorNotifications,
} from "../../src/lib/services/operator-notifications";
import {
  DEFAULT_OPERATOR_NOTIFICATIONS,
  OPERATOR_NOTIFICATIONS_SETTING_KEY,
} from "../../src/lib/config/operator-notifications";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const OPERATOR = "provoz@navigym.test";
const SECOND_OPERATOR = "druhy@navigym.test";
const MEMBER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "clen@example.test",
  fullName: "Jan Testovací",
  phone: "+420777000333",
};
const VOUCHER = "TESTOPERATOR100";
const CONSENT = new Date();

function slot(daysAhead: number, minute = 10 * 60): Date {
  return localDateTimeToDate(
    addDaysToDateKey(dateKeyInTimeZone(new Date()), daysAhead),
    minute,
  );
}

async function configure(
  recipients: string,
  events: Partial<typeof DEFAULT_OPERATOR_NOTIFICATIONS.events> = {},
): Promise<void> {
  await setSetting(OPERATOR_NOTIFICATIONS_SETTING_KEY, {
    recipients,
    events: { ...DEFAULT_OPERATOR_NOTIFICATIONS.events, ...events },
  });
}

/** The operator's own e-mails, in the order the application sent them. */
function operatorEmails() {
  return resend.sent.filter((mail) =>
    [OPERATOR, SECOND_OPERATOR].includes(
      Array.isArray(mail.to) ? (mail.to[0] ?? "") : mail.to,
    ),
  );
}

async function bookFreeEntry(startsAt: Date): Promise<string> {
  const outcome = await startBooking({
    userId: MEMBER.id,
    startsAt,
    details: {
      name: MEMBER.fullName,
      email: MEMBER.email,
      phone: MEMBER.phone,
      acceptedAt: CONSENT,
    },
    voucherCode: VOUCHER,
  });
  assert.equal(outcome.kind, "free");
  return outcome.reservationId;
}

describe(
  "operator notifications",
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
      // The settings table survives the reset (it holds the seeded content),
      // so this one is cleared by hand: several tests here turn events off.
      await rows("delete from site_setting where key = $1", [
        OPERATOR_NOTIFICATIONS_SETTING_KEY,
      ]);
      await seedProfile(MEMBER);
      await seedVoucher({ code: VOUCHER, kind: "percentage", value: 100 });
    });

    test("a confirmed booking reaches every configured address once", async () => {
      await configure(`${OPERATOR}, ${SECOND_OPERATOR}`);
      const startsAt = slot(9);
      const reservationId = await bookFreeEntry(startsAt);

      const first = operatorEmails();
      assert.equal(first.length, 2, "one e-mail per address");
      assert.deepEqual(
        first.map((mail) => mail.to),
        [OPERATOR, SECOND_OPERATOR],
      );
      assert.match(first[0]!.subject, /^Nová rezervace \| NAVI Private Gym$/);
      assert.match(
        first[0]!.text ?? "",
        /Jan Testovací má potvrzenou rezervaci/,
      );
      assert.match(first[0]!.text ?? "", /Zákazník: Jan Testovací/);
      assert.match(first[0]!.text ?? "", /E-mail: clen@example\.test/);
      assert.match(first[0]!.text ?? "", /Účet: registrovaný člen/);
      assert.match(first[0]!.text ?? "", /Cena: zdarma \(voucher\)/);
      // The link back into the administration survives into the text part.
      assert.match(first[0]!.text ?? "", /\/admin\/members\/22222222-/);

      // Recorded next to the customer's own mail, so the administration shows it.
      const deliveries = await rows<{
        kind: string;
        status: string;
        recipient: string;
        dedupe_key: string | null;
      }>(
        "select kind, status, recipient, dedupe_key from message_delivery where kind = 'operator_notice' order by recipient",
        [],
      );
      assert.equal(deliveries.length, 2);
      assert.deepEqual(
        deliveries.map((row) => row.status),
        ["sent", "sent"],
      );
      assert.ok(
        deliveries.every((row) =>
          row.dedupe_key?.startsWith(`reservationConfirmed:${reservationId}:`),
        ),
        "each delivery claims the reservation for its address",
      );

      // Never filed under the member: their own page lists what was sent to
      // them, and this went to the operator.
      assert.ok(
        (
          await rows(
            "select id from message_delivery where kind = 'operator_notice' and user_id is not null",
          )
        ).length === 0,
        "the operator's mail is not the member's mail",
      );

      // The watchdog retries fulfillment; the operator is not told twice.
      await fulfillReservation(reservationId);
      assert.equal(operatorEmails().length, 2);
    });

    test("a send refused for rate limiting is retried, not lost", async () => {
      await configure(OPERATOR);
      // The customer's confirmation goes first and takes the allowance with
      // it; the operator's notice is refused once and has to survive that.
      resend.rateLimitNext(1);
      const reservationId = await bookFreeEntry(slot(16));

      assert.equal(operatorEmails().length, 1);
      const [delivery] = await rows<{ status: string; dedupe_key: string }>(
        "select status, dedupe_key from message_delivery where kind = 'operator_notice'",
      );
      assert.equal(delivery?.status, "sent");
      assert.ok(delivery?.dedupe_key?.includes(reservationId));
    });

    test("an event the operator switched off is not sent", async () => {
      await configure(OPERATOR, { reservationConfirmed: false });
      await bookFreeEntry(slot(10));
      assert.equal(operatorEmails().length, 0);
    });

    test("without an address nothing is sent", async () => {
      await configure("");
      await bookFreeEntry(slot(11));
      assert.equal(operatorEmails().length, 0);
      const deliveries = await rows(
        "select id from message_delivery where kind = 'operator_notice'",
      );
      assert.equal(deliveries.length, 0);
    });

    test("a moved term and a cancelled booking each say what changed", async () => {
      // Cancellations are off by default, because the person cancelling is
      // usually the one who would read the e-mail.
      await configure(OPERATOR, { reservationCancelled: true });
      const startsAt = slot(12);
      const reservationId = await bookFreeEntry(startsAt);
      resend.sent.length = 0;

      const reservation = await getReservation(reservationId);
      await notifyReservationRescheduled({
        reservation: reservation!,
        previousStartsAt: slot(13),
      });
      const moved = operatorEmails().at(-1);
      assert.match(moved!.subject, /^Změna termínu \|/);
      assert.match(moved!.text ?? "", /Původní termín: /);
      assert.match(moved!.text ?? "", /Nový termín: /);

      await cancelReservation({
        id: reservationId,
        reason: "Zkušební storno v administraci.",
      });
      const cancelled = operatorEmails().at(-1);
      assert.match(cancelled!.subject, /^Zrušená rezervace \|/);
      assert.match(
        cancelled!.text ?? "",
        /Důvod: Zkušební storno v administraci\./,
      );
    });

    test("a pending hold that expires is not reported as a cancellation", async () => {
      await configure(OPERATOR, { reservationCancelled: true });
      const startsAt = slot(14);
      const [row] = await rows<{ id: string }>(
        `insert into reservation (user_id, starts_at, ends_at, status, price_cents, contact_email)
         values ($1, $2, $3, 'pending', 22900, $4) returning id`,
        [
          MEMBER.id,
          startsAt,
          new Date(startsAt.getTime() + 75 * 60_000),
          MEMBER.email,
        ],
      );
      await cancelReservation({ id: row!.id, reason: "expired" });
      assert.equal(operatorEmails().length, 0);
    });

    test("an operational alert reaches the operator by e-mail", async () => {
      await configure(OPERATOR);
      await raiseAlert({
        severity: "critical",
        title: "Zrušená zaplacená rezervace vyžaduje vrácení platby",
        body: "Vraťte platbu v portálu Comgate a dejte zákazníkovi vědět.",
        dedupeKey: "refund-needed:test",
      });
      const alert = operatorEmails().at(-1);
      assert.match(alert!.subject, /^Provozní problém \|/);
      assert.match(alert!.text ?? "", /vyžaduje vrácení platby/);
      assert.match(alert!.text ?? "", /Závažnost: Kritické/);

      // The same alert raised again is suppressed before it is ever sent.
      await raiseAlert({
        severity: "critical",
        title: "Zrušená zaplacená rezervace vyžaduje vrácení platby",
        dedupeKey: "refund-needed:test",
      });
      assert.equal(
        operatorEmails().filter((mail) =>
          mail.subject.startsWith("Provozní problém"),
        ).length,
        1,
      );
    });

    test("an alert remains pending after email failure and the watchdog delivers it once", async () => {
      await configure(OPERATOR);
      resend.rateLimitNext(2);
      const alert = await raiseAlert({
        title: "Testovací výpadek doručení",
        dedupeKey: "test:alert-retry",
      });
      assert.ok(alert);
      const [failed] = await rows<{ notified_at: Date | null }>(
        "select notified_at from system_alert where id = $1",
        [alert.id],
      );
      assert.equal(
        failed?.notified_at,
        null,
        "a refused email is not a notification",
      );
      assert.equal(operatorEmails().length, 0);
      assert.equal(await deliverPendingAlerts(), 1);
      const [delivered] = await rows<{ notified_at: Date | null }>(
        "select notified_at from system_alert where id = $1",
        [alert.id],
      );
      assert.ok(delivered?.notified_at);
      assert.equal(operatorEmails().length, 1);
      assert.equal(await deliverPendingAlerts(), 0);
      assert.equal(operatorEmails().length, 1);
    });

    test("a crash after provider acceptance recovers the same operator notice only once", async () => {
      await configure(OPERATOR);
      // The provider accepts the POST, then this local DB trigger simulates a
      // process dying before its success marker can be committed.
      await rows(`create function test_operator_write_crash() returns trigger language plpgsql as $$
        begin raise exception 'local operator write crash'; end; $$`);
      await rows(`create trigger test_operator_write_crash before update of status on message_delivery
        for each row when (old.kind = 'operator_notice' and new.status = 'sent')
        execute function test_operator_write_crash()`);
      let alertId: string;
      try {
        const alert = await raiseAlert({
          title: "Izolovaný test obnovy e-mailu",
          dedupeKey: "test:operator-crash",
        });
        assert.ok(alert);
        alertId = alert.id;
      } finally {
        await rows(
          "drop trigger if exists test_operator_write_crash on message_delivery",
        );
        await rows("drop function if exists test_operator_write_crash()");
      }
      assert.equal(operatorEmails().length, 1);
      const [pending] = await rows<{
        id: string;
        status: string;
        provider_response: unknown;
      }>(
        "select id, status, provider_response from message_delivery where kind = 'operator_notice'",
      );
      assert.equal(pending?.status, "queued");
      assert.ok(pending?.provider_response);
      const [unnotified] = await rows<{ notified_at: Date | null }>(
        "select notified_at from system_alert where id = $1",
        [alertId!],
      );
      assert.equal(unnotified?.notified_at, null);
      await rows(
        "update message_delivery set updated_at = now() - interval '6 minutes' where id = $1",
        [pending!.id],
      );
      assert.equal(await retryPendingOperatorNotices(), 1);
      assert.equal(
        operatorEmails().length,
        1,
        "Resend accepted one actual message",
      );
      const [recovered] = await rows<{
        status: string;
        provider_message_id: string;
        provider_response: unknown;
      }>(
        "select status, provider_message_id, provider_response from message_delivery where id = $1",
        [pending!.id],
      );
      assert.equal(recovered?.status, "sent");
      assert.ok(recovered?.provider_message_id);
      assert.equal(
        recovered?.provider_response,
        null,
        "payload is erased after acceptance",
      );
      assert.equal(await deliverPendingAlerts(), 1);
      const [notified] = await rows<{ notified_at: Date | null }>(
        "select notified_at from system_alert where id = $1",
        [alertId!],
      );
      assert.ok(notified?.notified_at);
      assert.equal(operatorEmails().length, 1);
    });

    test("what the administration saves is what the next booking uses", async () => {
      const chosen = {
        recipients: `${OPERATOR}, ${SECOND_OPERATOR}`,
        events: {
          ...DEFAULT_OPERATOR_NOTIFICATIONS.events,
          reservationConfirmed: false,
          memberRegistered: true,
        },
      };
      await saveOperatorNotifications(chosen, MEMBER.id);
      assert.deepEqual(await getOperatorNotifications(), chosen);

      await bookFreeEntry(slot(15));
      assert.equal(operatorEmails().length, 0, "the event they switched off");
    });

    test("with nothing configured the site's own contact address is used", async () => {
      const settings = await getOperatorNotifications();
      assert.equal(settings.recipients, "info@navigym.cz");
      assert.equal(settings.events.reservationConfirmed, true);
    });
  },
);
