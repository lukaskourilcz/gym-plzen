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
export const DEFAULT_ENTRY_PRICE_CENTS = 29_000; // 290 Kč

export const ENTRY_CURRENCY = "czk";

/**
 * Loyalty cadence: every `FREE_ENTRY_EVERY`-th entry is free. With the default
 * of 10, entries 1–9 are paid and entry 10 is free, then the cycle repeats.
 */
export const FREE_ENTRY_EVERY = 10;

/** Site-setting key under which the admin-overridable entry price is stored. */
export const ENTRY_PRICE_SETTING_KEY = "pricing.entry_price_cents";
