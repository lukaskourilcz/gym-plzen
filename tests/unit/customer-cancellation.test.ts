import test from "node:test";
import assert from "node:assert/strict";
import { cancellationPrice } from "../../src/lib/config/customer-cancellation";
import { getRescheduleEligibility } from "../../src/lib/config/rescheduling";
const base = {
  priceCents: 19900,
  currency: "czk",
  loyaltyReward: null,
  additionalPeoplePaidCents: 0,
};
test("cancellation explains the actual amount including a paid companion addition", () => {
  const result = cancellationPrice({
    ...base,
    additionalPeoplePaidCents: 10000,
  });
  assert.equal(result.amount, 29900);
  assert.match(result.note, /299.*nevrací/);
});
test("zero price is only a bonus when the booking actually claims a loyalty reward", () => {
  assert.equal(cancellationPrice({ ...base, priceCents: 0 }).bonus, false);
  assert.doesNotMatch(
    cancellationPrice({ ...base, priceCents: 0 }).note,
    /bonusový/,
  );
  const bonus = cancellationPrice({ ...base, priceCents: 0, loyaltyReward: 1 });
  assert.equal(bonus.bonus, true);
  assert.match(bonus.note, /bonusový 10. vstup zdarma/);
  assert.doesNotMatch(bonus.note, /Zaplacených/);
  assert.equal(cancellationPrice({ ...base, priceCents: null }).amount, null);
});
test("UI and write path share an absolute 24-hour boundary across Prague DST", () => {
  const startsAt = new Date("2026-10-25T05:00:00Z");
  assert.equal(
    getRescheduleEligibility(
      { status: "confirmed", startsAt },
      false,
      new Date("2026-10-24T05:00:00Z"),
    ).eligible,
    true,
  );
  assert.equal(
    getRescheduleEligibility(
      { status: "confirmed", startsAt },
      false,
      new Date("2026-10-24T05:00:00.001Z"),
    ).eligible,
    false,
  );
});
