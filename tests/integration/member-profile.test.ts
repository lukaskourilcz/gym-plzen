/**
 * The administration's member profile reads: reservation history with its
 * payment, voucher and document, deliveries and the activity log for one
 * member, and never another member's rows.
 */
import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { record, listForMember } from "../../src/lib/services/activity";
import { listHistoryForUser } from "../../src/lib/services/reservations";
import { listForUser } from "../../src/lib/services/messages";

const ANNA = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "anna@example.test",
  fullName: "Anna Testová",
};
const BORIS = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "boris@example.test",
  fullName: "Boris Testový",
};

describe(
  "member profile data",
  { skip: !databaseReady && "needs a local DATABASE_URL" },
  () => {
    before(startProviders);
    after(stopEverything);
    beforeEach(async () => {
      await resetDatabase();
      await seedProfile(ANNA);
      await seedProfile(BORIS);
    });

    test("history carries payment, voucher, document and the term change", async () => {
      const startsAt = new Date("2026-10-05T08:00:00.000Z");
      const endsAt = new Date("2026-10-05T09:15:00.000Z");
      const [reservation] = await rows<{ id: string }>(
        `insert into reservation (user_id, starts_at, ends_at, status, price_cents, contact_email)
         values ($1, $2, $3, 'confirmed', 19900, $4) returning id`,
        [ANNA.id, startsAt, endsAt, ANNA.email],
      );
      await rows(
        `insert into payment (user_id, reservation_id, type, status, amount_cents, provider, provider_payment_id)
         values ($1, $2, 'one_off', 'succeeded', 19900, 'comgate', 'TEST-PAID')`,
        [ANNA.id, reservation!.id],
      );
      const [voucher] = await rows<{ id: string }>(
        `insert into voucher (code, kind, value) values ('PODZIM', 'percentage', 10) returning id`,
      );
      await rows(
        `insert into voucher_redemption (voucher_id, reservation_id, status, original_price_cents, discount_cents, final_price_cents, reserved_until)
         values ($1, $2, 'redeemed', 22900, 3000, 19900, now())`,
        [voucher!.id, reservation!.id],
      );
      await rows(
        `insert into reservation_reschedule (reservation_id, user_id, previous_starts_at, previous_ends_at, new_starts_at, new_ends_at)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          reservation!.id,
          ANNA.id,
          new Date("2026-10-04T08:00:00.000Z"),
          new Date("2026-10-04T09:15:00.000Z"),
          startsAt,
          endsAt,
        ],
      );
      // Boris has his own reservation, which must stay his.
      await rows(
        `insert into reservation (user_id, starts_at, ends_at, status, price_cents, contact_email)
         values ($1, $2, $3, 'cancelled', 22900, $4)`,
        [
          BORIS.id,
          new Date("2026-10-06T08:00:00.000Z"),
          new Date("2026-10-06T09:15:00.000Z"),
          BORIS.email,
        ],
      );

      const history = await listHistoryForUser(ANNA.id);
      assert.equal(history.length, 1);
      const [row] = history;
      assert.equal(row?.id, reservation!.id);
      assert.equal(row?.paymentStatus, "succeeded");
      assert.equal(row?.voucherCode, "PODZIM");
      assert.equal(row?.invoiceNumber, null);
      assert.equal(row?.rescheduled, true);
      assert.equal((await listHistoryForUser(BORIS.id)).length, 1);
    });

    test("activity and deliveries are scoped to the member", async () => {
      await record({
        action: "member.role_changed",
        actorType: "admin",
        actorLabel: "admin@example.test",
        memberId: ANNA.id,
        summary: "Člen získal roli správce.",
      });
      await record({
        action: "member.profile_updated",
        actorType: "admin",
        actorLabel: "admin@example.test",
        memberId: BORIS.id,
        summary: "Profil člena upraven správcem.",
      });
      await rows(
        `insert into message_delivery (user_id, reservation_id, channel, kind, recipient, status)
         values ($1, null, 'email', 'reservation_confirmation', $2, 'sent')`,
        [ANNA.id, ANNA.email],
      );

      const entries = await listForMember(ANNA.id);
      assert.deepEqual(
        entries.map((entry) => entry.action),
        ["member.role_changed"],
      );
      assert.equal((await listForMember(BORIS.id)).length, 1);
      assert.equal((await listForUser(ANNA.id)).length, 1);
      assert.equal((await listForUser(BORIS.id)).length, 0);
    });
  },
);
