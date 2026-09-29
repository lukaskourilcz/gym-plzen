import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { getTomorrowOverview } from "../../src/lib/services/tomorrow";

const owner = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-09-30T18:00:00Z"); // 20:00 Prague, Oct 1 is tomorrow.

describe(
  "admin tomorrow checklist",
  { skip: !databaseReady && "needs a local test database" },
  () => {
    after(stopEverything);
    beforeEach(resetDatabase);

    test("shows only planned next-day slots and distinguishes opt-in delivery from unpaid holds", async () => {
      await seedProfile({
        id: owner,
        email: "owner@example.test",
        fullName: "Owner",
        phone: "+420777000111",
      });
      await rows(
        "update profiles set notify_by_whatsapp = true where id = $1",
        [owner],
      );
      const [confirmed] = await rows<{ id: string }>(
        `insert into reservation (user_id, starts_at, ends_at, status, contact_name, contact_email)
       values ($1, '2026-10-01 08:00+00', '2026-10-01 09:15+00', 'confirmed', 'Owner', 'owner@example.test') returning id`,
        [owner],
      );
      assert.ok(confirmed);
      await rows(
        `insert into reservation (starts_at, ends_at, status, contact_name)
       values ('2026-10-01 09:15+00', '2026-10-01 10:30+00', 'pending', 'Pending'),
              ('2026-10-01 10:30+00', '2026-10-01 11:45+00', 'cancelled', 'Cancelled'),
              ('2026-10-02 08:00+00', '2026-10-02 09:15+00', 'confirmed', 'Another day')`,
      );
      await rows(
        `insert into message_delivery (reservation_id, channel, kind, recipient, status)
       values ($1, 'email', 'access_code', 'owner@example.test', 'sent'),
              ($1, 'whatsapp', 'access_code', '+420777000111', 'delivered')`,
        [confirmed.id],
      );

      const overview = await getTomorrowOverview(now);
      assert.equal(overview.dateKey, "2026-10-01");
      assert.equal(overview.confirmed, 1);
      assert.equal(overview.pending, 1);
      assert.equal(overview.rows.length, 2);
      assert.equal(overview.needsAttention, 1); // A due confirmed booking still lacks its PIN.
      assert.deepEqual(
        overview.rows.map((row) => [
          row.contactName,
          row.codeCheck,
          row.email,
          row.whatsApp,
        ]),
        [
          ["Owner", "missing", "sent", "delivered"],
          [
            "Pending",
            "awaiting_payment",
            "awaiting_payment",
            "awaiting_payment",
          ],
        ],
      );
      assert.equal("codeHash" in overview.rows[0]!, false);
    });

    test("flags a historical early PIN send without sending another message", async () => {
      const [booking] = await rows<{ id: string }>(
        `insert into reservation (starts_at, ends_at, status, contact_name, contact_email)
         values ('2026-10-01 20:00+00', '2026-10-01 21:15+00', 'confirmed', 'Historical', 'historical@example.test') returning id`,
      );
      assert.ok(booking);
      await rows(
        `insert into message_delivery (reservation_id, channel, kind, recipient, status, sent_at)
         values ($1, 'email', 'access_code', 'historical@example.test', 'sent', '2026-09-20 10:30+00')`,
        [booking.id],
      );

      const overview = await getTomorrowOverview(now);
      assert.equal(overview.rows[0]?.codeCheck, "scheduled");
      assert.equal(overview.rows[0]?.email, "sent_early");
      assert.equal(overview.needsAttention, 1);
      assert.equal(
        (
          await rows<{ count: string }>(
            "select count(*) from message_delivery where reservation_id = $1",
            [booking.id],
          )
        )[0]?.count,
        "1",
      );
    });
  },
);
