/**
 * Pricing & loyalty configuration.
 *
 * The gym currently sells a single product: a one-time entry. There are no
 * monthly subscriptions. Every Nth paid entry is free (a loyalty reward), and
 * members see a counter of their progress toward the next free entry.
 *
 * These are defaults; the entry price can be overridden at runtime from the
 * admin (stored under the `pricing.entry` site setting : see cms.getSetting).
 */

/** Default price of a single entry, in the smallest currency unit (haléř). */
export const DEFAULT_ENTRY_PRICE_CENTS = 22_900; // 229 Kč

export const ENTRY_CURRENCY = "czk";

/**
 * How many people one reservation admits. The whole space is booked
 * exclusively, so the copy quotes a per-person price derived from this.
 */
export const GYM_CAPACITY = 5;

/**
 * Loyalty cadence: every `FREE_ENTRY_EVERY`-th entry is free. With the default
 * of 10, entries 1–9 are paid and entry 10 is free, then the cycle repeats.
 */
export const FREE_ENTRY_EVERY = 10;

/** Site-setting key under which the admin-overridable fallback price is stored. */
export const ENTRY_PRICE_SETTING_KEY = "pricing.entry_price_cents";

/**
 * A time-limited price, set from the administration.
 *
 * The period is checked against the visit start, independent of purchase date.
 * Loyalty is unaffected, so every tenth entry stays free inside the window too.
 */
export interface PricingWindow {
  id?: string;
  name?: string;
  priceCents: number;
  /** Inclusive start, as an absolute instant. */
  startsAt: Date;
  /** Exclusive end, as an absolute instant. */
  endsAt: Date;
}

/** Backwards-compatible type name used by older pricing tests and scripts. */
export type PromoWindow = PricingWindow;

export interface EntryPrice {
  /** What the customer pays right now. */
  priceCents: number;
  /** The price outside the promotion, so the site can show what is saved. */
  standardPriceCents: number;
  /** True while the promotional window is running. */
  isPromo: boolean;
  /** When the running promotion ends, for the note on the site. */
  promoEndsAt?: Date;
  /** Admin label of the price period that matched. */
  periodName?: string;
}

/**
 * Resolve the entry price at a given moment. Pure, so the whole promotion rule
 * is testable without a database or a clock.
 *
 * A window with a non-positive price, or one whose end is not after its start,
 * is ignored rather than trusted: a misconfigured promotion must never make
 * entry free by accident.
 */
export function resolveEntryPrice(params: {
  standardPriceCents: number;
  periods?: readonly PricingWindow[];
  /** Compatibility input for callers that still provide a single period. */
  promo?: PromoWindow | null;
  at: Date;
}): EntryPrice {
  const { standardPriceCents, at } = params;
  const periods = [
    ...(params.periods ?? []),
    ...(params.promo ? [params.promo] : []),
  ];
  const active = periods.find(
    (period) =>
      period.priceCents > 0 &&
      period.endsAt.getTime() > period.startsAt.getTime() &&
      at.getTime() >= period.startsAt.getTime() &&
      at.getTime() < period.endsAt.getTime(),
  );

  if (active) {
    return {
      priceCents: active.priceCents,
      standardPriceCents,
      isPromo: true,
      // Periods are [start, end); expose the last included instant so the
      // public note says “do 31. 10.” rather than “do 1. 11.”.
      promoEndsAt: new Date(active.endsAt.getTime() - 1),
      periodName: active.name,
    };
  }

  return { priceCents: standardPriceCents, standardPriceCents, isPromo: false };
}
