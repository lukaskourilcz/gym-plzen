import assert from "node:assert/strict";
import test from "node:test";
import { minimumScheduledEntryPrice } from "../../src/lib/config/display-pricing";
import { resolveEntryPrice } from "../../src/lib/config/pricing";
import { pricingSlots } from "../../src/lib/config/block-pricing";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const at = (day: string, minute = 0) => localDateTimeToDate(day, minute);
const hours = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openMinute: 300,
  closeMinute: 1425,
  slotMinutes: 75,
  isClosed: 0,
}));
const rules = hours.map(({ dayOfWeek }) => ({
  id: `00000000-0000-4000-8000-00000000000${dayOfWeek}`,
  dayOfWeek,
  startMinute: 300,
  endMinute: 375,
  priceCents: 19900,
}));
const input = {
  standardPriceCents: 23900,
  hours,
  blockPrices: rules,
  periods: [],
  now: at("2026-11-01", 720),
  horizonDays: 180,
  bookingsFrom: "",
};

test("from price uses the cheapest applied block, including another weekday", () => {
  assert.equal(minimumScheduledEntryPrice(input), 19900);
  assert.equal(
    minimumScheduledEntryPrice({ ...input, blockPrices: [rules[1]!] }),
    19900,
  );
});

test("only actual aligned open-day rules count; covered standard prices do not", () => {
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      blockPrices: rules.map((rule) => ({ ...rule, startMinute: 301 })),
    }),
    23900,
  );
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      blockPrices: [rules[1]!],
      hours: hours.map((h) => ({ ...h, isClosed: h.dayOfWeek === 1 ? 1 : 0 })),
    }),
    23900,
  );
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      blockPrices: rules.map((r) => ({
        ...r,
        endMinute: 1425,
        priceCents: 26900,
      })),
    }),
    26900,
  );
});

test("periods override blocks, expired and out-of-horizon prices never win", () => {
  const period = {
    priceCents: 29900,
    startsAt: at("2026-11-01"),
    endsAt: at("2027-11-01"),
  };
  assert.equal(
    minimumScheduledEntryPrice({ ...input, periods: [period] }),
    29900,
  );
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      periods: [{ ...period, endsAt: at("2026-11-02") }],
    }),
    19900,
  );
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      periods: [{ ...period, priceCents: 14900, endsAt: at("2026-11-01") }],
    }),
    19900,
  );
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      periods: [{ ...period, priceCents: 14900, startsAt: at("2027-10-01") }],
    }),
    19900,
  );
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      periods: [{ ...period, priceCents: 14900, startsAt: at("2026-12-01") }],
    }),
    14900,
  );
});

test("a partial first weekday does not hide its cheap morning next week", () => {
  assert.equal(
    minimumScheduledEntryPrice({ ...input, blockPrices: [rules[0]!] }),
    19900,
  );
});

test("opening date and booking horizon exclude unoffered periods", () => {
  const promo = {
    priceCents: 9900,
    startsAt: at("2026-11-02"),
    endsAt: at("2026-11-03"),
  };
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      periods: [promo],
      bookingsFrom: "2026-11-03",
    }),
    19900,
  );
  assert.equal(
    minimumScheduledEntryPrice({
      ...input,
      blockPrices: [],
      periods: [
        { ...promo, startsAt: at("2027-04-30"), endsAt: at("2027-05-01") },
      ],
    }),
    9900,
  );
});

test("empty schedules retain the safe configured fallback", () => {
  assert.equal(minimumScheduledEntryPrice({ ...input, hours: [] }), 23900);
  assert.equal(
    minimumScheduledEntryPrice({ ...input, blockPrices: [] }),
    23900,
  );
});

test("weekly sampling matches exhaustive slot prices across Prague DST and period boundaries", () => {
  for (const day of ["2026-10-20", "2027-03-20"]) {
    const params = {
      ...input,
      now: at(day, 720),
      horizonDays: 40,
      blockPrices: rules.map((r) => ({
        ...r,
        priceCents: 18000 + r.dayOfWeek * 1000,
      })),
      periods: [
        {
          priceCents: 24900,
          startsAt: at(day),
          endsAt: at(addDaysToDateKey(day, 10), 340),
        },
        {
          priceCents: 14900,
          startsAt: at(addDaysToDateKey(day, 30), 360),
          endsAt: at(addDaysToDateKey(day, 31), 330),
        },
      ],
    };
    let expected = Infinity;
    for (let i = 0; i <= params.horizonDays; i++) {
      const date = addDaysToDateKey(dateKeyInTimeZone(params.now), i);
      const h = hours.find((h) => h.dayOfWeek === dayOfWeek(at(date, 720)))!;
      for (const slot of pricingSlots(h)) {
        const startsAt = at(date, slot.startMinute);
        if (startsAt > params.now)
          expected = Math.min(
            expected,
            resolveEntryPrice({ ...params, at: startsAt }).priceCents,
          );
      }
    }
    assert.equal(minimumScheduledEntryPrice(params), expected);
  }
});
