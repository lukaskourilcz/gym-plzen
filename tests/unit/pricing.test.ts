import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  resolveEntryPrice,
  type PromoWindow,
} from "../../src/lib/config/pricing";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";
import { pricingPeriodSchema } from "../../src/lib/validations/memberships";

const STANDARD = DEFAULT_ENTRY_PRICE_CENTS;

/**
 * 199 Kč for visits between 1 October and the end of 31 October, Prague time.
 */
const OCTOBER: PromoWindow = {
  priceCents: 19_900,
  name: "Říjnová akce",
  startsAt: localDateTimeToDate("2026-10-01", 0),
  endsAt: localDateTimeToDate("2026-11-01", 0),
};

const at = (dateKey: string, minute = 12 * 60) =>
  localDateTimeToDate(dateKey, minute);

test("the standard entry price is 229 Kč", () => {
  assert.equal(STANDARD, 22_900);
});

test("without a promotion the standard price always applies", () => {
  const price = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: null,
    at: at("2026-10-15"),
  });
  assert.deepEqual(price, {
    priceCents: STANDARD,
    standardPriceCents: STANDARD,
    isPromo: false,
  });
});

test("the promotion applies inside its window and nowhere else", () => {
  const before = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-09-30", 23 * 60 + 59),
  });
  assert.equal(before.priceCents, STANDARD);
  assert.equal(before.isPromo, false);

  const during = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-10-15"),
  });
  assert.equal(during.priceCents, 19_900);
  assert.equal(during.standardPriceCents, STANDARD);
  assert.equal(during.isPromo, true);
  assert.equal(
    during.promoEndsAt?.toISOString(),
    new Date(OCTOBER.endsAt.getTime() - 1).toISOString(),
  );
  assert.equal(during.periodName, "Říjnová akce");

  // 1 November is back to the standard price, which is what the client asked
  // for: "od listopadu 229 Kč".
  const after = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-11-01", 0),
  });
  assert.equal(after.priceCents, STANDARD);
  assert.equal(after.isPromo, false);
});

test("the window uses Prague calendar days and an exclusive end", () => {
  // The first instant of 1 October in Prague is already the promotion.
  const opening = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-10-01", 0),
  });
  assert.equal(opening.isPromo, true);

  // The last minute of 31 October still is.
  const closing = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-10-31", 23 * 60 + 59),
  });
  assert.equal(closing.isPromo, true);

  // October crosses the end of summer time (25 October 2026), so the window is
  // measured as absolute instants rather than wall-clock offsets.
  assert.equal(OCTOBER.startsAt.toISOString(), "2026-09-30T22:00:00.000Z");
  assert.equal(OCTOBER.endsAt.toISOString(), "2026-10-31T23:00:00.000Z");
  const afterDstSwitch = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-10-26"),
  });
  assert.equal(afterDstSwitch.isPromo, true);
});

test("multiple scheduled periods resolve independently", () => {
  const december: PromoWindow = {
    name: "Prosincová cena",
    priceCents: 24_900,
    startsAt: localDateTimeToDate("2026-12-01", 0),
    endsAt: localDateTimeToDate("2027-01-01", 0),
  };
  const result = resolveEntryPrice({
    standardPriceCents: STANDARD,
    periods: [OCTOBER, december],
    at: at("2026-12-15"),
  });
  assert.equal(result.priceCents, 24_900);
  assert.equal(result.periodName, "Prosincová cena");
});

test("admin price periods accept inclusive days and reject ambiguous input", () => {
  const sameDay = pricingPeriodSchema.safeParse({
    name: "Jednodenní akce",
    priceCzk: 199,
    startsOn: "2026-10-01",
    endsOn: "2026-10-01",
  });
  assert.equal(sameDay.success, true);

  assert.equal(
    pricingPeriodSchema.safeParse({
      name: "Obrácené období",
      priceCzk: 199,
      startsOn: "2026-10-02",
      endsOn: "2026-10-01",
    }).success,
    false,
  );
  assert.equal(
    pricingPeriodSchema.safeParse({
      name: "Neplatné datum",
      priceCzk: 199.5,
      startsOn: "2026-02-30",
      endsOn: "2026-03-01",
    }).success,
    false,
  );
});

test("a misconfigured window is ignored rather than trusted", () => {
  // Nothing here may hand out a free or negative entry by accident.
  const zeroPrice = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: { ...OCTOBER, priceCents: 0 },
    at: at("2026-10-15"),
  });
  assert.equal(zeroPrice.priceCents, STANDARD);
  assert.equal(zeroPrice.isPromo, false);

  const inverted = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: {
      ...OCTOBER,
      startsAt: OCTOBER.endsAt,
      endsAt: OCTOBER.startsAt,
    },
    at: at("2026-10-15"),
  });
  assert.equal(inverted.priceCents, STANDARD);
  assert.equal(inverted.isPromo, false);
});

test("a promotion may raise the price as well as lower it", () => {
  // The rule is "the window decides", not "the cheaper of the two".
  const raised = resolveEntryPrice({
    standardPriceCents: 19_900,
    promo: { ...OCTOBER, priceCents: 28_900 },
    at: at("2026-10-15"),
  });
  assert.equal(raised.priceCents, 28_900);
  assert.equal(raised.isPromo, true);
});

test("October visits cost 199 Kč regardless of purchase date; later visits cost 229 Kč", () => {
  const octoberVisit = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-10-20"),
  });
  assert.equal(octoberVisit.priceCents, 19_900);

  const novemberVisit = resolveEntryPrice({
    standardPriceCents: STANDARD,
    promo: OCTOBER,
    at: at("2026-11-02"),
  });
  assert.equal(novemberVisit.priceCents, STANDARD);
  assert.equal(
    resolveEntryPrice({
      standardPriceCents: STANDARD,
      promo: OCTOBER,
      at: at("2026-12-15"),
    }).priceCents,
    22_900,
  );
});

test("booking, details and voucher quotes all pass the visit date to pricing", async () => {
  const { readFile } = await import("node:fs/promises");
  const booking = await readFile("src/lib/services/booking.ts", "utf8");
  const details = await readFile("src/app/rezervace/udaje/page.tsx", "utf8");
  const vouchers = await readFile("src/app/rezervace/actions.ts", "utf8");
  assert.match(booking, /getEntryPriceCents\(params.startsAt\)/);
  assert.match(details, /getEntryPriceCents\(startsAt\)/);
  assert.match(details, /priceForNextEntry\(session.user.id, startsAt\)/);
  assert.match(vouchers, /getEntryPriceCents\(new Date\(input.startsAt\)\)/);
});

test("rescheduling never re-prices a reservation", async () => {
  // Moving a slot must not re-run pricing: a customer who booked during the
  // promotion keeps their price when they move the booking afterwards.
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("src/lib/services/rescheduling.ts", "utf8"),
  );
  assert.doesNotMatch(source, /priceCents\s*[:=]/);
  assert.doesNotMatch(source, /getEntryPrice|priceForNextEntry/);
});

test("price resolution never throws on a missing moment or a malformed period", () => {
  // The account page failed in production with `at` undefined at runtime;
  // the standard price is the safe answer, not a crash.
  const missing = resolveEntryPrice({
    standardPriceCents: STANDARD,
    periods: [OCTOBER],
    at: undefined as unknown as Date,
  });
  assert.equal(missing.priceCents, STANDARD);
  assert.equal(missing.isPromo, false);

  const stringified = resolveEntryPrice({
    standardPriceCents: STANDARD,
    periods: [
      {
        ...OCTOBER,
        startsAt: "2026-10-01T00:00:00.000Z" as unknown as Date,
      },
    ],
    at: at("2026-10-15"),
  });
  assert.equal(stringified.priceCents, STANDARD);

  const invalid = resolveEntryPrice({
    standardPriceCents: STANDARD,
    periods: [OCTOBER],
    at: new Date("not a date"),
  });
  assert.equal(invalid.priceCents, STANDARD);
});
