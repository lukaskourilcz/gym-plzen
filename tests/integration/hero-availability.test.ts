import { databaseReady, resetDatabase, rows, stopEverything } from "./setup";
import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import { getHeroDay } from "../../src/lib/services/hero-availability";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";

describe("lazy hero day availability", { skip: !databaseReady }, () => {
  beforeEach(resetDatabase);
  after(stopEverything);
  const now = new Date("2026-10-01T12:00:00Z");
  test("returns only the selected day, with blocks and public slot fields", async () => {
    const date = "2026-10-25"; // winter-time transition
    const startsAt = localDateTimeToDate(date, 5 * 60);
    await rows(
      "insert into blocked_slot (starts_at, ends_at, reason) values ($1, $2, 'maintenance')",
      [startsAt, new Date(startsAt.getTime() + 75 * 60_000)],
    );
    const result = await getHeroDay(date, now);
    assert.ok(result);
    assert.equal(result.source, "live");
    assert.equal(result.day.dateLabel, date);
    assert.ok(result.day.slots.length > 0);
    assert.equal(
      result.day.slots.find((slot) => slot.startMs === startsAt.getTime())
        ?.booked,
      true,
    );
    for (const slot of result.day.slots) {
      assert.deepEqual(Object.keys(slot).sort(), [
        "booked",
        "label",
        "price",
        "startMs",
      ]);
      assert.ok(slot.startMs >= localDateTimeToDate(date, 0).getTime());
      assert.ok(slot.startMs < localDateTimeToDate("2026-10-26", 0).getTime());
      assert.match(slot.price, /229/);
    }
    assert.equal(JSON.stringify(result).includes("maintenance"), false);
    const nextDay = await getHeroDay("2026-10-26", now);
    assert.ok(nextDay);
    assert.equal(
      nextDay.day.slots.some((slot) => slot.booked),
      false,
    );
  });
  test("refuses dates outside the 180-day range", async () => {
    assert.equal(await getHeroDay("2027-03-31", now), null);
    assert.equal(await getHeroDay("2026-09-30", now), null);
    assert.equal(await getHeroDay("2026-11-31", now), null);
    assert.ok(await getHeroDay("2027-03-30", now));
  });
});
