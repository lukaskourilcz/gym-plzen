/** Provider state can only move a successful local payment to a refund, never
 * back to pending/failed because of reordered callbacks. */
export function nextPaymentStatus(
  current: string,
  state: string,
): "pending" | "processing" | "succeeded" | "failed" | "refunded" {
  if (current === "refunded") return "refunded";
  if (state === "REFUNDED") return "refunded";
  if (current === "succeeded") return "succeeded";
  if (state === "PAID") return "succeeded";
  if (state === "CANCELLED") return "failed";
  if (current === "failed") return "failed";
  return state === "PENDING" ? "pending" : "processing";
}

export function paymentMatches(
  expected: {
    id: string;
    providerPaymentId: string | null;
    amountCents: number;
    currency: string;
  },
  actual: {
    id: string;
    orderNumber: string;
    amountMinor: number;
    currency: string;
  },
) {
  return (
    expected.providerPaymentId === actual.id &&
    expected.id === actual.orderNumber &&
    expected.amountCents === actual.amountMinor &&
    expected.currency.toUpperCase() === actual.currency.toUpperCase()
  );
}
