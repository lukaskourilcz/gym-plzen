import {
  databaseReady,
  resetDatabase,
  rows,
  seedVoucher,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { getFinanceOverview } from "../../src/lib/services/finance";

const now = new Date("2026-09-30T12:00:00Z");

describe(
  "admin finance uses actual settled payments",
  { skip: !databaseReady && "needs a local test database" },
  () => {
    after(stopEverything);
    beforeEach(resetDatabase);

    test("one multi-slot payment counts once; failed attempts, released vouchers and resolved refund alerts stay distinct", async () => {
      const [order] = await rows<{ id: string }>(
        "insert into booking_order (total_cents, status) values (10000, 'confirmed') returning id",
      );
      assert.ok(order);
      const reservations = await rows<{ id: string }>(
        `insert into reservation (order_id, starts_at, ends_at, status, price_cents)
       values ($1, '2026-10-01 08:00+00', '2026-10-01 09:15+00', 'confirmed', 5000),
              ($1, '2026-10-01 09:15+00', '2026-10-01 10:30+00', 'confirmed', 5000)
       returning id`,
        [order.id],
      );
      assert.equal(reservations.length, 2);
      const [cancelled] = await rows<{ id: string }>(
        `insert into reservation (starts_at, ends_at, status, cancelled_at)
       values ('2026-10-02 08:00+00', '2026-10-02 09:15+00', 'cancelled', '2026-09-30 10:00+00') returning id`,
      );
      assert.ok(cancelled);
      await rows(
        `insert into payment (order_id, type, status, amount_cents, paid_at, provider)
       values ($1, 'one_off', 'succeeded', 10000, '2026-09-30 10:00+00', 'comgate'),
              ($1, 'one_off', 'failed', 10000, null, 'comgate')`,
        [order.id],
      );
      await rows(
        `insert into payment (reservation_id, type, status, amount_cents, paid_at, provider)
       values ($1, 'one_off', 'refunded', 3000, '2026-09-30 10:00+00', 'legacy'),
              ($1, 'one_off', 'succeeded', 4000, '2026-09-20 10:00+00', 'legacy')`,
        [cancelled.id],
      );
      await seedVoucher({
        code: "TEST-FINANCE",
        kind: "fixed_amount",
        value: 5000,
      });
      const [voucher] = await rows<{ id: string }>(
        "select id from voucher where code = 'TEST-FINANCE'",
      );
      assert.ok(voucher);
      await rows(
        `insert into voucher_redemption
         (voucher_id, reservation_id, order_id, status, original_price_cents, discount_cents, final_price_cents, reserved_until, redeemed_at)
       values ($1, $2, $3, 'redeemed', 15000, 5000, 10000, '2026-10-01 00:00+00', '2026-09-30 10:00+00'),
              ($1, $4, null, 'released', 1000, 1000, 0, '2026-10-01 00:00+00', '2026-09-30 10:00+00')`,
        [voucher.id, reservations[0]!.id, order.id, reservations[1]!.id],
      );
      await rows(
        `insert into system_alert (dedupe_key, title, context, resolved_at, created_at)
       values ('refund-needed:one', 'Refund', '{"amountCents":2000}'::jsonb, '2026-09-30 11:00+00', '2026-09-30 10:00+00'),
              ('refund-needed:two', 'Refund', '{"amountCents":3000}'::jsonb, null, '2026-09-30 10:00+00'),
              ('other', 'Other', '{"amountCents":9999}'::jsonb, null, '2026-09-30 10:00+00')`,
      );

      const all = await getFinanceOverview("all", now);
      assert.equal(all.receipts.count, 3);
      assert.equal(all.receipts.grossCents, 17000);
      assert.deepEqual(all.vouchers, { count: 1, discountCents: 5000 });
      assert.equal(all.cancellations.count, 1);
      assert.deepEqual(all.refundAlerts, {
        count: 2,
        amountCents: 5000,
        openCount: 1,
        openAmountCents: 3000,
      });

      const seven = await getFinanceOverview("7d", now);
      assert.equal(seven.receipts.grossCents, 13000);
      assert.equal(seven.receipts.count, 2);
      assert.equal(seven.vouchers.count, 1);
    });
  },
);
