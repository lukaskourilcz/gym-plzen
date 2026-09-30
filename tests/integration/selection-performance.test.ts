import {
  databaseReady,
  resetDatabase,
  rows,
  setSetting,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { db } from "../../src/lib/db";
import { loadSiteContent } from "../../src/lib/content/site";
import { getEntryPriceCents } from "../../src/lib/services/loyalty";
import {
  resolveBookableSlot,
  resolveBookableSlots,
} from "../../src/lib/services/slots";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";

describe(
  "selected-slot configuration and pricing (#173, #174)",
  { skip: !databaseReady },
  () => {
    after(stopEverything);
    beforeEach(resetDatabase);

    test("batch resolution preserves order, closed days, grid and booking floor", async () => {
      await setSetting("booking.operations", {
        paymentsEnabled: true,
        accessCodesEnabled: false,
        bookingsFrom: "2026-10-02",
      });
      await rows(
        "update opening_hours set is_closed = 1 where day_of_week = 6",
      );
      const starts = [
        localDateTimeToDate("2026-10-01", 600),
        localDateTimeToDate("2026-10-02", 600),
        localDateTimeToDate("2026-10-03", 600),
        localDateTimeToDate("2026-10-04", 601),
        localDateTimeToDate("2026-10-25", 600),
      ];
      const batch = await resolveBookableSlots(starts);
      assert.deepEqual(
        batch,
        await Promise.all(starts.map(resolveBookableSlot)),
      );
      assert.equal(batch[0], null);
      assert.ok(batch[1]);
      assert.equal(batch[2], null);
      assert.equal(batch[3], null);
      assert.ok(batch[4]);
      assert.deepEqual(await resolveBookableSlots([]), []);
    });

    test("ten-slot selection keeps exact date prices while reducing database round trips", async () => {
      const starts = Array.from({ length: 10 }, (_, index) =>
        localDateTimeToDate("2026-10-02", (5 + index) * 60),
      );
      await rows(
        `insert into pricing_period (name, price_cents, starts_at, ends_at) values ('Synthetic period', 19900, $1, $2)`,
        [starts[3], starts[7]],
      );
      // Count statements, never parameters or customer data. Timings are diagnostic,
      // not a machine-dependent pass/fail threshold.
      const client = db.$client;
      const original = client.options.debug;
      let queries = 0;
      client.options.debug = () => {
        queries++;
      };
      try {
        const beforeAt = performance.now();
        const before = await Promise.all(
          starts.map(async (start) => ({
            slot: await resolveBookableSlot(start),
            price: await getEntryPriceCents(start),
          })),
        );
        const beforeMs = performance.now() - beforeAt;
        const beforeQueries = queries;
        queries = 0;
        const afterAt = performance.now();
        const [slots, content] = await Promise.all([
          resolveBookableSlots(starts),
          loadSiteContent("cs", { strict: true }),
        ]);
        const result = starts.map((start, index) => ({
          slot: slots[index],
          price: content.entryPriceForDate(start),
        }));
        const afterMs = performance.now() - afterAt;
        assert.deepEqual(result, before);
        assert.equal(result[2]!.price, 22900);
        assert.equal(result[3]!.price, 19900);
        assert.equal(result[6]!.price, 19900);
        assert.equal(result[7]!.price, 22900);
        assert.ok(
          queries < beforeQueries / 2,
          "selection must not grow a query chain per slot",
        );
        console.log(
          JSON.stringify({
            beforeQueries,
            afterQueries: queries,
            beforeMs: Math.round(beforeMs),
            afterMs: Math.round(afterMs),
          }),
        );
      } finally {
        client.options.debug = original;
      }
    });
  },
);
