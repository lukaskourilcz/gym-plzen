import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservation } from "@/lib/db/schema";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  FREE_ENTRY_EVERY,
  PROMO_ENDS_AT_SETTING_KEY,
  PROMO_PRICE_SETTING_KEY,
  PROMO_STARTS_AT_SETTING_KEY,
  resolveEntryPrice,
  type EntryPrice,
  type PromoWindow,
} from "@/lib/config/pricing";
import { getSetting } from "./cms";

/**
 * Loyalty & entry-pricing service.
 *
 * An "entry" is a non-cancelled reservation (confirmed or completed). Every
 * `FREE_ENTRY_EVERY`-th entry is free. This module answers two questions:
 *   - how many entries has a member had, and how many until the next free one?
 *   - is the entry a member is *about to book* free, and what should it cost?
 */

/** Reservation statuses that count as a real entry toward loyalty. */
const COUNTED_STATUSES = ["confirmed", "completed"] as const;

export interface LoyaltyStatus {
  /** Entries so far (confirmed or completed). */
  totalEntries: number;
  /** Position within the current cycle: 0…FREE_ENTRY_EVERY-1. */
  positionInCycle: number;
  /** Entries the member still has to make to earn the next free one, 1 to N. */
  entriesUntilFree: number;
  /** Total free entries earned so far. */
  freeEntriesEarned: number;
  /** True when the member's *next* booking is free. */
  nextEntryIsFree: boolean;
  /** Reward cadence (for rendering "X / N"). */
  cadence: number;
}

/** Count a member's entries that count toward loyalty. */
export async function countEntries(userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(reservation)
    .where(
      and(
        eq(reservation.userId, userId),
        inArray(reservation.status, [...COUNTED_STATUSES]),
      ),
    );
  return row?.value ?? 0;
}

/**
 * Entry counts for many members at once. The admin member list needs a number
 * per row, and one grouped query keeps that from turning into an N+1.
 * Members with no counted entry are simply absent from the map.
 */
export async function countEntriesForUsers(
  userIds: string[],
): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: reservation.userId, value: count() })
    .from(reservation)
    .where(
      and(
        inArray(reservation.userId, userIds),
        inArray(reservation.status, [...COUNTED_STATUSES]),
      ),
    )
    .groupBy(reservation.userId);
  return new Map(
    rows.flatMap((row) =>
      row.userId ? [[row.userId, row.value] as const] : [],
    ),
  );
}

/** Compute the member's loyalty status from their entry count. */
export async function getLoyaltyStatus(userId: string): Promise<LoyaltyStatus> {
  const totalEntries = await countEntries(userId);
  return deriveLoyaltyStatus(totalEntries);
}

/**
 * Pure derivation of loyalty status from an entry count : separated so it is
 * trivially unit-testable and reusable (e.g. in the customer widget).
 */
export function deriveLoyaltyStatus(totalEntries: number): LoyaltyStatus {
  const positionInCycle = totalEntries % FREE_ENTRY_EVERY;
  /*
   * Counts the remaining entries *including* the free one, so it is never zero:
   * right after a free entry the member is a full cadence away from the next.
   * A modulo here would read "0 remaining" while the next entry costs full
   * price.
   */
  const entriesUntilFree = FREE_ENTRY_EVERY - positionInCycle;
  return {
    totalEntries,
    positionInCycle,
    entriesUntilFree,
    freeEntriesEarned: Math.floor(totalEntries / FREE_ENTRY_EVERY),
    // The next booking is free when completing it lands on a multiple of the
    // cadence : i.e. the member already has FREE_ENTRY_EVERY-1 in this cycle.
    nextEntryIsFree: positionInCycle === FREE_ENTRY_EVERY - 1,
    cadence: FREE_ENTRY_EVERY,
  };
}

/** The standard entry price (admin override, falling back to the default). */
export async function getStandardEntryPriceCents(): Promise<number> {
  const override = await getSetting<number>(ENTRY_PRICE_SETTING_KEY);
  return typeof override === "number" && override >= 0
    ? override
    : DEFAULT_ENTRY_PRICE_CENTS;
}

/** Parse a stored ISO timestamp, ignoring anything unusable. */
function readInstant(value: unknown): Date | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The promotional window an administrator configured, if it is complete. */
export async function getPromoWindow(): Promise<PromoWindow | null> {
  const [priceCents, startsAt, endsAt] = await Promise.all([
    getSetting<number>(PROMO_PRICE_SETTING_KEY),
    getSetting<string>(PROMO_STARTS_AT_SETTING_KEY),
    getSetting<string>(PROMO_ENDS_AT_SETTING_KEY),
  ]);
  const start = readInstant(startsAt);
  const end = readInstant(endsAt);
  if (typeof priceCents !== "number" || !start || !end) return null;
  return { priceCents, startsAt: start, endsAt: end };
}

/**
 * What an entry costs at a given moment, with the promotion applied.
 *
 * `at` is the moment the customer is booking, never the slot they book: a
 * reservation created during the promotion keeps the promotional price even
 * for a slot months later.
 */
export async function getEntryPrice(
  at: Date = new Date(),
): Promise<EntryPrice> {
  const [standardPriceCents, promo] = await Promise.all([
    getStandardEntryPriceCents(),
    getPromoWindow(),
  ]);
  return resolveEntryPrice({ standardPriceCents, promo, at });
}

/** The price a customer pays right now. */
export async function getEntryPriceCents(
  at: Date = new Date(),
): Promise<number> {
  return (await getEntryPrice(at)).priceCents;
}

/**
 * Resolve what a member's next entry costs: 0 if it's their free entry,
 * otherwise the current entry price.
 */
export async function priceForNextEntry(
  userId: string,
  at: Date = new Date(),
): Promise<{ priceCents: number; isFree: boolean }> {
  const [status, price] = await Promise.all([
    getLoyaltyStatus(userId),
    getEntryPriceCents(at),
  ]);
  // The reward outranks the promotion: the tenth entry is free either way.
  return status.nextEntryIsFree
    ? { priceCents: 0, isFree: true }
    : { priceCents: price, isFree: false };
}

/**
 * How many of the cadence's steps read as complete. Shared by the classic
 * segment bar and the modern ring so the two can never disagree: a member whose
 * next entry is free sees a full track, which is the reward being ready rather
 * than the cycle being over.
 */
export function loyaltyFilledSegments(status: LoyaltyStatus): number {
  return status.nextEntryIsFree ? status.cadence : status.positionInCycle;
}

/** Czech pluralisation for "vstup" (1 / 2 to 4 / 5+). */
export function pluralEntries(n: number): string {
  if (n === 1) return "vstup";
  if (n >= 2 && n <= 4) return "vstupy";
  return "vstupů";
}

/**
 * "zbývá 1 vstup" / "zbývají 3 vstupy" / "zbývá 9 vstupů".
 *
 * Czech agreement: the plural verb goes with 2 to 4, while 1 and the genitive
 * plural from 5 up both take the singular. Shared so the widget and the
 * confirmation copy cannot disagree about it.
 */
export function entriesRemainingPhrase(n: number): string {
  const verb = n >= 2 && n <= 4 ? "zbývají" : "zbývá";
  return `${verb} ${n} ${pluralEntries(n)}`;
}

/**
 * One Czech sentence about the member's loyalty progress, for the confirmation
 * e-mail and the confirmation page. Returns an empty string when there is
 * nothing truthful to say : a guest booking has no account to count against, so
 * the surrounding template must collapse the empty paragraph.
 *
 * Call it with the status *after* the reservation being confirmed is counted.
 */
export function loyaltyProgressSentence(status: LoyaltyStatus): string {
  const { totalEntries, positionInCycle, entriesUntilFree, cadence } = status;
  if (totalEntries <= 0) return "";

  const visit = `Tohle byla vaše ${totalEntries}. návštěva`;

  // A completed cycle: this very entry was the free one.
  if (positionInCycle === 0) {
    return `${visit} a byla zdarma. Další vstup zdarma vás čeká po ${cadence} návštěvách.`;
  }
  if (status.nextEntryIsFree) {
    return `${visit}. Příští vstup máte zdarma.`;
  }
  return `${visit}, do vstupu zdarma ${entriesRemainingPhrase(entriesUntilFree)}.`;
}
