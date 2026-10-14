import assert from "node:assert/strict";
import test from "node:test";
import {
  isBlockPriceAligned,
  pricingSlots,
  resolveBlockPrice,
  type BlockPrice,
} from "../../src/lib/config/block-pricing";
import { localDateTimeToDate } from "../../src/lib/helpers/datetime";
import {
  parseParticipantsEnabled,
  participantAdditionPrice,
  participantSurcharge,
  DEFAULT_PARTICIPANT_PRICING,
} from "../../src/lib/config/participants";

const hours = {
  dayOfWeek: 3,
  openMinute: 345,
  closeMinute: 1425,
  slotMinutes: 75,
  isClosed: 0,
};
const rule: BlockPrice = {
  id: "00000000-0000-4000-8000-000000000001",
  dayOfWeek: 3,
  startMinute: 345,
  endMinute: 645,
  priceCents: 19_900,
};
test("prices select whole configured slots, including a last partial-day boundary", () => {
  assert.deepEqual(pricingSlots(hours)[0], {
    startMinute: 345,
    endMinute: 420,
  });
  assert.equal(pricingSlots(hours).at(-1)?.endMinute, 1395);
  assert.equal(isBlockPriceAligned(rule, hours), true);
  assert.equal(isBlockPriceAligned({ ...rule, endMinute: 630 }, hours), false);
  assert.equal(isBlockPriceAligned(rule, { ...hours, isClosed: 1 }), false);
  assert.equal(isBlockPriceAligned(rule, { ...hours, openMinute: 300 }), false);
});
test("block prices use Prague weekday and exclusive boundaries across summer and winter", () => {
  for (const day of ["2026-10-14", "2026-11-04"]) {
    assert.equal(
      resolveBlockPrice(localDateTimeToDate(day, 345), [rule], [hours], 22_900),
      19_900,
    );
    assert.equal(
      resolveBlockPrice(localDateTimeToDate(day, 570), [rule], [hours], 22_900),
      19_900,
    );
    assert.equal(
      resolveBlockPrice(localDateTimeToDate(day, 645), [rule], [hours], 22_900),
      22_900,
    );
  }
  assert.equal(
    resolveBlockPrice(
      localDateTimeToDate("2026-10-15", 345),
      [rule],
      [hours],
      22_900,
    ),
    22_900,
  );
  assert.equal(
    resolveBlockPrice(
      localDateTimeToDate("2026-10-14", 345),
      [rule],
      [{ ...hours, openMinute: 300 }],
      22_900,
    ),
    22_900,
  );
});
test("one or two additional people cost 100 Kč together by default", () => {
  assert.equal(participantSurcharge(0, DEFAULT_PARTICIPANT_PRICING), 0);
  assert.equal(participantSurcharge(1, DEFAULT_PARTICIPANT_PRICING), 10_000);
  assert.equal(participantSurcharge(2, DEFAULT_PARTICIPANT_PRICING), 10_000);
  assert.equal(participantAdditionPrice(1, 2, DEFAULT_PARTICIPANT_PRICING), 0);
  const perPerson = { amountCents: 10_000, mode: "per_person" as const };
  assert.equal(participantSurcharge(2, perPerson), 20_000);
  assert.equal(participantAdditionPrice(1, 2, perPerson), 10_000);
  for (const count of [-1, 3, 0.5, NaN])
    assert.throws(() => participantSurcharge(count, perPerson));
});

test("companions are off unless an explicit boolean true is saved", () => {
  for (const value of [undefined, null, false, 0, 1, "true", {}, []])
    assert.equal(parseParticipantsEnabled(value), false);
  assert.equal(parseParticipantsEnabled(true), true);
});
