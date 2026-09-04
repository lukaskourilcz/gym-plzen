import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateVoucherQuote,
  normalizeVoucherCode,
} from "../../src/lib/services/vouchers";

describe("vouchers", () => {
  it("normalizes codes without changing their meaning", () => {
    assert.equal(normalizeVoucherCode("  podzim- 2026 "), "PODZIM-2026");
  });

  it("calculates percentage discounts in minor currency units", () => {
    assert.deepEqual(
      calculateVoucherQuote(
        { code: "PCT", kind: "percentage", value: 20 },
        29_000,
      ),
      {
        code: "PCT",
        kind: "percentage",
        value: 20,
        originalPriceCents: 29_000,
        discountCents: 5_800,
        finalPriceCents: 23_200,
      },
    );
  });

  it("caps a fixed discount at the reservation price", () => {
    const quote = calculateVoucherQuote(
      { code: "FREE", kind: "fixed_amount", value: 50_000 },
      29_000,
    );
    assert.equal(quote.discountCents, 29_000);
    assert.equal(quote.finalPriceCents, 0);
  });

  it("turns sub-minimum CZK Stripe totals into a free reservation", () => {
    const quote = calculateVoucherQuote(
      { code: "ALMOST", kind: "fixed_amount", value: 28_000 },
      29_000,
    );
    assert.equal(quote.discountCents, 29_000);
    assert.equal(quote.finalPriceCents, 0);
  });
});
