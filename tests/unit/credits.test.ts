import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changedReservationPrice,
  creditTender,
} from "../../src/lib/config/credits";
test("new slot retains voucher and companions; reward has no nominal credit", () => {
  const price = {
    baseCents: 22900,
    companionCents: 10000,
    reward: false,
    discount: { kind: "percentage" as const, value: 10 },
  };
  assert.equal(changedReservationPrice(25900, price), 32310);
  assert.equal(
    changedReservationPrice(99900, {
      ...price,
      reward: true,
      companionCents: 0,
    }),
    0,
  );
  assert.equal(
    changedReservationPrice(500, {
      ...price,
      companionCents: 0,
      discount: { kind: "fixed_amount", value: 1000 },
    }),
    0,
  );
});
test("credit tender is bounded, exact and cannot create sub-minimum cash charges", () => {
  assert.equal(creditTender(6000, 4000, true), 4000);
  assert.equal(creditTender(6000, 9000, true), 6000);
  assert.equal(creditTender(6000, 5999, true), 5900);
  assert.equal(creditTender(6000, 4000, false), 0);
  assert.throws(() => creditTender(-1, 2, true));
  assert.throws(() => creditTender(1.5, 2, true));
});
