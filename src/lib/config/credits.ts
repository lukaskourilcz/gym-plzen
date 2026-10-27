/** Version 1 belongs to every reservation made before this release. */
export const CREDIT_PRICING_VERSION = 2;
export const CREDIT_TERMS_VERSION = "2026-10-27-credits-v1";
export interface ReservationPriceSnapshot {
  baseCents: number;
  purchasePriceCents?: number;
  purchasedStartsAt?: string;
  companionCents: number;
  reward: boolean;
  discount: { kind: "percentage" | "fixed_amount"; value: number } | null;
}
export function assertMoney(value: number): void {
  if (!Number.isSafeInteger(value) || Math.abs(value) > 100_000_000)
    throw new Error("Neplatná částka.");
}
export function changedReservationPrice(
  baseCents: number,
  saved: ReservationPriceSnapshot,
): number {
  assertMoney(baseCents);
  const gross = (saved.reward ? 0 : baseCents) + saved.companionCents;
  const discount = !saved.discount
    ? 0
    : saved.discount.kind === "percentage"
      ? Math.floor((gross * saved.discount.value) / 100)
      : saved.discount.value;
  return Math.max(0, gross - discount);
}
/** Never silently round a charge up. Leave >= 1 CZK for the gateway. */
export function creditTender(
  total: number,
  available: number,
  requested: boolean,
): number {
  assertMoney(total);
  assertMoney(available);
  if (total < 0 || available < 0) throw new Error("Neplatný zůstatek.");
  if (!requested) return 0;
  const used = Math.min(total, available);
  return total > used && total - used < 100 ? Math.max(0, total - 100) : used;
}

/** Stable integer allocation: sum equals tender exactly, no floating currency. */
export function allocateCredit(
  prices: readonly number[],
  amount: number,
): number[] {
  const total = prices.reduce((a, b) => a + b, 0);
  if (amount < 0 || amount > total)
    throw new Error("Neplatná alokace kreditu.");
  let allocated = 0,
    cumulative = 0;
  return prices.map((price) => {
    cumulative += price;
    const next = total ? Math.floor((amount * cumulative) / total) : 0;
    const share = next - allocated;
    allocated = next;
    return share;
  });
}
