import {
  databaseReady,
  resetDatabase,
  rows,
  setSetting,
  startProviders,
  stopEverything,
  comgate,
  resend,
} from "./setup";
import assert from "node:assert/strict";
import { before, beforeEach, after, test, describe } from "node:test";
import { randomUUID } from "node:crypto";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
import {
  startOrder,
  quoteOrder,
  resolveOrderSlots,
} from "../../src/lib/services/orders";
import { getEntryPriceCents } from "../../src/lib/services/loyalty";
import { loadCalendarAvailability } from "../../src/lib/services/calendar-availability";
import { loadSiteContent } from "../../src/lib/content/site";

async function existingData() {
  return rows(
    "select (select jsonb_agg(to_jsonb(r) order by id) from reservation r where contact_email='existing@example.test') as bookings, (select jsonb_agg(to_jsonb(c) order by id) from access_code c) as codes, (select jsonb_agg(to_jsonb(m) order by id) from message_delivery m) as messages, (select jsonb_agg(to_jsonb(e) order by id) from email_archive e) as emails",
  );
}
describe(
  "period-first pricing across calendar and orders",
  { skip: !databaseReady },
  () => {
    before(startProviders);
    beforeEach(resetDatabase);
    after(stopEverything);
    test("each selected visit gets its own price and saved customers and open checkouts retain their amounts", async () => {
      const today = dateKeyInTimeZone(new Date());
      const firstDay = addDaysToDateKey(today, 5),
        secondDay = addDaysToDateKey(today, 6);
      const starts = [
        localDateTimeToDate(firstDay, 600),
        localDateTimeToDate(secondDay, 600),
      ];
      const existingId = randomUUID();
      await rows(
        "insert into reservation(id,starts_at,ends_at,status,price_cents,contact_email) values ($1,$2,$3,'confirmed',27900,'existing@example.test')",
        [
          existingId,
          localDateTimeToDate(firstDay, 480),
          localDateTimeToDate(firstDay, 540),
        ],
      );
      await rows(
        "insert into access_code(reservation_id,code_hash,valid_from,valid_until,status) values ($1,'synthetic-only',$2,$3,'scheduled')",
        [
          existingId,
          localDateTimeToDate(firstDay, 480),
          localDateTimeToDate(firstDay, 555),
        ],
      );
      const beforeData = await existingData();
      await setSetting("pricing.entry_price_cents", 23900);
      await rows(
        "insert into pricing_period(name,price_cents,starts_at,ends_at) values ('Synthetic period',19900,$1,$2)",
        [localDateTimeToDate(firstDay, 0), localDateTimeToDate(secondDay, 0)],
      );
      const blockPrices = Array.from({ length: 7 }, (_, dayOfWeek) => ({
        id: randomUUID(),
        dayOfWeek,
        startMinute: 600,
        endMinute: 660,
        priceCents: 32900,
      }));
      await setSetting("pricing.time_blocks", blockPrices);
      const content = await loadSiteContent("cs", { strict: true });
      for (const [index, date] of [firstDay, secondDay].entries()) {
        const expected = index === 0 ? 19900 : 32900;
        const snapshot = await loadCalendarAvailability({ date });
        assert.equal(
          snapshot.view.selectedSlots.find(
            (s) => s.startISO === starts[index]!.toISOString(),
          )?.priceCents,
          expected,
        );
        assert.equal(content.entryPriceForDate(starts[index]!), expected);
        assert.equal(await getEntryPriceCents(starts[index]!), expected);
      }
      const slots = await resolveOrderSlots(starts);
      const quote = await quoteOrder({ userId: null, slots });
      assert.deepEqual(
        quote.slots.map((s) => s.priceCents),
        [19900, 32900],
      );
      assert.equal(quote.totalCents, 52800);
      const request = {
        userId: null,
        starts,
        details: {
          name: "Synthetic buyer",
          email: "new@example.test",
          phone: "+420777000111",
          acceptedAt: new Date(),
        },
      };
      const order = await startOrder(request);
      assert.equal(order.kind, "checkout");
      if (order.kind !== "checkout") return;
      assert.equal(order.totalCents, quote.totalCents);
      const saved = await rows(
        "select * from reservation where order_id=$1 order by starts_at",
        [order.orderId],
      );
      assert.deepEqual(
        saved.map((s) => s.price_cents),
        [19900, 32900],
      );
      await setSetting(
        "pricing.time_blocks",
        blockPrices.map((rule) => ({ ...rule, priceCents: 44900 })),
      );
      const resumed = await startOrder({
        ...request,
        hold: { kind: "order", id: order.orderId, token: order.token! },
      });
      assert.equal(resumed.kind, "checkout");
      if (resumed.kind === "checkout") {
        assert.equal(resumed.url, order.url);
        assert.equal(resumed.totalCents, 52800);
      }
      assert.deepEqual(
        await rows(
          "select * from reservation where order_id=$1 order by starts_at",
          [order.orderId],
        ),
        saved,
      );
      assert.deepEqual(await existingData(), beforeData);
      assert.equal(comgate.creates.length, 1);
      assert.equal(resend.sent.length, 0);
    });
  },
);
