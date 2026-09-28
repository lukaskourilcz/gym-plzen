/**
 * Pure arithmetic of a multi-slot order, kept apart from the database so the
 * rules the customer is charged by are unit-testable.
 */

/**
 * Which slots of an order are loyalty rewards. The slots, sorted by start,
 * continue the member's count of counted entries: every one that lands on a
 * multiple of the cadence is free, so an order can hold the 10th and the 20th
 * entry at once. Returns the reward number (1 for the 10th entry, 2 for the
 * 20th, …) per slot, or null for a paid slot.
 */
export function allocateLoyaltyRewards(
  countedEntries: number,
  slotCount: number,
  cadence: number,
): (number | null)[] {
  return Array.from({ length: slotCount }, (_, index) => {
    const entry = countedEntries + index + 1;
    return entry % cadence === 0 ? entry / cadence : null;
  });
}

/**
 * Spread an order-level discount over its slots in proportion to their
 * prices, so each reservation keeps the amount it was actually sold for
 * (a refund of one slot then refunds that slot's share). Whole cents are
 * floored per slot; the rounding remainder goes to the last paid slot, and
 * backwards from there should a slot not have room for it, so the prices
 * always add up to exactly what the customer pays.
 */
export function splitOrderDiscount(
  prices: readonly number[],
  discountCents: number,
): number[] {
  const total = prices.reduce((sum, price) => sum + price, 0);
  const discount = Math.min(Math.max(0, discountCents), total);
  if (total === 0 || discount === 0) return [...prices];
  const shares = prices.map((price) => Math.floor((discount * price) / total));
  let remainder = discount - shares.reduce((sum, share) => sum + share, 0);
  for (let index = prices.length - 1; index >= 0 && remainder > 0; index--) {
    const room = prices[index]! - shares[index]!;
    const extra = Math.min(room, remainder);
    shares[index]! += extra;
    remainder -= extra;
  }
  return prices.map((price, index) => price - shares[index]!);
}
