import assert from "node:assert/strict";
import test from "node:test";
import { resolveEntryPrice } from "../../src/lib/config/pricing";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";

const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openMinute: 0,
  closeMinute: 1440,
  slotMinutes: 60,
  isClosed: 0,
}));
const blocks = hours.map(({ dayOfWeek }) => ({
  id: `00000000-0000-4000-8000-00000000000${dayOfWeek}`,
  dayOfWeek,
  startMinute: 0,
  endMinute: 1440,
  priceCents: 32900,
}));
const period = {
  name: "Říjnová akce",
  priceCents: 19900,
  startsAt: localDateTimeToDate("2026-10-01", 0),
  endsAt: localDateTimeToDate("2026-11-01", 0),
};
const input = {
  standardPriceCents: 23900,
  periods: [period],
  blockPrices: blocks,
  hours,
};

test("visit-date period wins over both cheaper and more expensive block prices", () => {
  for (const priceCents of [14900, 19900, 32900]) {
    const result = resolveEntryPrice({
      ...input,
      blockPrices: blocks.map((b) => ({ ...b, priceCents })),
      at: localDateTimeToDate("2026-10-20", 600),
    });
    assert.equal(result.priceCents, 19900);
    assert.equal(result.isPromo, true);
    assert.equal(result.periodName, "Říjnová akce");
    assert.equal(result.promoEndsAt?.getTime(), period.endsAt.getTime() - 1);
  }
});
test("Prague October boundary and winter-time change keep period priority", () => {
  for (const date of ["2026-10-24", "2026-10-25", "2026-10-31"]) {
    assert.equal(
      resolveEntryPrice({ ...input, at: localDateTimeToDate(date, 1439) })
        .priceCents,
      19900,
    );
  }
  assert.equal(
    resolveEntryPrice({ ...input, at: period.startsAt }).priceCents,
    19900,
  );
  const november = resolveEntryPrice({ ...input, at: period.endsAt });
  assert.equal(november.priceCents, 32900);
  assert.equal(november.isPromo, false);
});
test("outside periods a matching block wins and unmatched visits use standard price", () => {
  const at = localDateTimeToDate("2026-11-02", 600);
  assert.equal(resolveEntryPrice({ ...input, at }).priceCents, 32900);
  assert.equal(
    resolveEntryPrice({ ...input, blockPrices: [], at }).priceCents,
    23900,
  );
  assert.equal(
    resolveEntryPrice({ ...input, periods: [{ ...period, priceCents: 0 }], at })
      .priceCents,
    32900,
  );
  assert.equal(
    resolveEntryPrice({ ...input, at: new Date("invalid") }).priceCents,
    23900,
  );
});
