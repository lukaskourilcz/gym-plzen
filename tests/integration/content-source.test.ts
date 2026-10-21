import {
  databaseReady,
  resetDatabase,
  rows,
  setSetting,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { loadSiteContent } from "../../src/lib/content/site";
import { upsertBlock } from "../../src/lib/services/cms";

describe("editable public content source", { skip: !databaseReady }, () => {
  beforeEach(resetDatabase);
  after(stopEverything);
  test("editor retains price/date/duration variables, while public content resolves the current configuration", async () => {
    const keys = [
      "home.pricing.promoNote",
      "faq.21.answer",
      "equipment.zone1.body",
    ];
    try {
      await upsertBlock({
        key: keys[0]!,
        valueText: "Cena {price}, návštěvy do {promoEndsAt}, délka {duration}.",
      });
      await upsertBlock({
        key: keys[1]!,
        valueText: "Vlastní odpověď klienta.",
      });
      await upsertBlock({
        key: keys[2]!,
        valueText: "Vlastní seznam: činky, lavička.",
      });
      await setSetting("pricing.entry_price_cents", 23900);
      await rows(
        "insert into pricing_period(name,price_cents,starts_at,ends_at) values ('Synthetic period',19900,'2026-09-30T22:00:00Z','2026-10-31T23:00:00Z')",
      );
      const content = await loadSiteContent("cs", {
        strict: true,
        at: new Date("2026-10-21T10:00:00Z"),
      });
      assert.equal(
        content.raw("home.pricing.promoNote"),
        "Cena {price}, návštěvy do {promoEndsAt}, délka {duration}.",
      );
      assert.match(
        content.get("home.pricing.promoNote"),
        /199.*31\. 10\. 2026.*60 minut/,
      );
      assert.equal(content.get("faq.21.answer"), "Vlastní odpověď klienta.");
      assert.equal(
        content.get("equipment.zone1.body"),
        "Vlastní seznam: činky, lavička.",
      );
      assert.equal((await rows("select * from reservation")).length, 0);
      assert.equal((await rows("select * from access_code")).length, 0);
      assert.equal((await rows("select * from message_delivery")).length, 0);
    } finally {
      for (const key of keys)
        await rows("delete from content_block where key=$1 and locale='cs'", [
          key,
        ]);
    }
  });
});
