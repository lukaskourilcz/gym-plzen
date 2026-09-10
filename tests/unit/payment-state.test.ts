import assert from "node:assert/strict";
import test from "node:test";
import {
  nextPaymentStatus,
  paymentMatches,
} from "../../src/lib/helpers/payment-state";
import {
  operationsSchema,
  DEFAULT_OPERATIONS,
} from "../../src/lib/config/operations";

test("a delayed pending/cancelled callback cannot downgrade a paid payment", () => {
  assert.equal(nextPaymentStatus("succeeded", "PENDING"), "succeeded");
  assert.equal(nextPaymentStatus("succeeded", "CANCELLED"), "succeeded");
  assert.equal(nextPaymentStatus("failed", "PAID"), "succeeded");
  assert.equal(nextPaymentStatus("pending", "AUTHORIZED"), "processing");
  assert.equal(nextPaymentStatus("pending", "CANCELLED"), "failed");
});
test("payment verification binds provider id, local reference, amount and currency", () => {
  const expected = {
    id: "local-order",
    providerPaymentId: "transaction",
    amountCents: 28900,
    currency: "czk",
  };
  const actual = {
    id: "transaction",
    orderNumber: "local-order",
    amountMinor: 28900,
    currency: "CZK",
  };
  assert.equal(paymentMatches(expected, actual), true);
  for (const patch of [
    { id: "another" },
    { orderNumber: "foreign-order" },
    { amountMinor: 1 },
    { currency: "EUR" },
  ])
    assert.equal(paymentMatches(expected, { ...actual, ...patch }), false);
});
test("payments and lock can be activated independently; no prebooking mode exists", () => {
  assert.equal(DEFAULT_OPERATIONS.paymentsEnabled, false);
  assert.equal(DEFAULT_OPERATIONS.accessCodesEnabled, false);
  assert.equal(
    operationsSchema.safeParse({ ...DEFAULT_OPERATIONS, paymentsEnabled: true })
      .success,
    true,
  );
  assert.equal(
    operationsSchema.safeParse({
      ...DEFAULT_OPERATIONS,
      bookingsFrom: "2026-02-30",
    }).success,
    false,
  );
});
