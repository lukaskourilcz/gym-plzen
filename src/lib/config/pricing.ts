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
export const DEFAULT_ENTRY_PRICE_CENTS = 28_900; // 289 Kč

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

/** Site-setting key under which the admin-overridable entry price is stored. */
export const ENTRY_PRICE_SETTING_KEY = "pricing.entry_price_cents";

/**
 * A time-limited promotional price, set from the administration.
 *
 * The window is checked against the moment a reservation is *created*, not the
 * slot it books: someone who books in October during the promotion pays the
 * promotional price even for a January slot. Loyalty is unaffected, so every
 * tenth entry stays free inside the window too.
 */
export const PROMO_PRICE_SETTING_KEY = "pricing.promo.price_cents";
export const PROMO_STARTS_AT_SETTING_KEY = "pricing.promo.starts_at";
export const PROMO_ENDS_AT_SETTING_KEY = "pricing.promo.ends_at";

export interface PromoWindow {
  priceCents: number;
  /** Inclusive start, as an absolute instant. */
  startsAt: Date;
  /** Inclusive end, as an absolute instant. */
  endsAt: Date;
}

export interface EntryPrice {
  /** What the customer pays right now. */
  priceCents: number;
  /** The price outside the promotion, so the site can show what is saved. */
  standardPriceCents: number;
  /** True while the promotional window is running. */
  isPromo: boolean;
  /** When the running promotion ends, for the note on the site. */
  promoEndsAt?: Date;
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
  promo?: PromoWindow | null;
  at: Date;
}): EntryPrice {
  const { standardPriceCents, promo, at } = params;
  const usable =
    promo &&
    promo.priceCents > 0 &&
    promo.endsAt.getTime() > promo.startsAt.getTime();

  if (
    usable &&
    at.getTime() >= promo.startsAt.getTime() &&
    at.getTime() <= promo.endsAt.getTime()
  ) {
    return {
      priceCents: promo.priceCents,
      standardPriceCents,
      isPromo: true,
      promoEndsAt: promo.endsAt,
    };
  }

  return { priceCents: standardPriceCents, standardPriceCents, isPromo: false };
}
