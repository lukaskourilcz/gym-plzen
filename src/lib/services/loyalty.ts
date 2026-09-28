import { and, count, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import { reservation } from "@/lib/db/schema";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  FREE_ENTRY_EVERY,
  resolveEntryPrice,
  type EntryPrice,
} from "@/lib/config/pricing";
import { getSetting } from "./cms";
import { getActivePricingPeriod } from "./pricing-periods";

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
export async function countEntries(
  userId: string,
  executor: DatabaseExecutor = db,
): Promise<number> {
  const [row] = await executor
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

/**
 * Loyalty status for many members in two grouped queries instead of two per
 * member: entry counts, plus the reward numbers already claimed, so the
 * "next entry is free" flag is as exact as the single-member version.
 */
export async function getLoyaltyStatusForUsers(
  userIds: string[],
): Promise<Map<string, LoyaltyStatus>> {
  const result = new Map<string, LoyaltyStatus>();
  if (userIds.length === 0) return result;
  const [counts, claims] = await Promise.all([
    countEntriesForUsers(userIds),
    db
      .select({ userId: reservation.userId, reward: reservation.loyaltyReward })
      .from(reservation)
      .where(
        and(
          inArray(reservation.userId, userIds),
          isNotNull(reservation.loyaltyReward),
          ne(reservation.status, "cancelled"),
        ),
      ),
  ]);
  const claimed = new Map<string, Set<number>>();
  for (const row of claims) {
    if (!row.userId || row.reward === null) continue;
    (
      claimed.get(row.userId) ??
      claimed.set(row.userId, new Set()).get(row.userId)!
    ).add(row.reward);
  }
  for (const userId of userIds) {
    const totalEntries = counts.get(userId) ?? 0;
    const status = deriveLoyaltyStatus(totalEntries);
    if (
      status.nextEntryIsFree &&
      claimed.get(userId)?.has(Math.floor(totalEntries / FREE_ENTRY_EVERY) + 1)
    )
      status.nextEntryIsFree = false;
    result.set(userId, status);
  }
  return result;
}

/** Compute the member's loyalty status from their entry count. */
export async function getLoyaltyStatus(userId: string): Promise<LoyaltyStatus> {
  const totalEntries = await countEntries(userId);
  const status = deriveLoyaltyStatus(totalEntries);
  if (
    status.nextEntryIsFree &&
    (await hasClaimedReward(
      userId,
      Math.floor(totalEntries / FREE_ENTRY_EVERY) + 1,
    ))
  )
    status.nextEntryIsFree = false;
  return status;
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

/**
 * What an entry costs at a given moment, with a scheduled period applied.
 *
 * `at` is the visit start, not the purchase moment. All booking paths must
 * supply it so a future October visit gets the October price in September.
 */
export async function getEntryPrice(at: Date): Promise<EntryPrice> {
  const [standardPriceCents, period] = await Promise.all([
    getStandardEntryPriceCents(),
    getActivePricingPeriod(at),
  ]);
  return resolveEntryPrice({
    standardPriceCents,
    periods: period ? [period] : [],
    at,
  });
}

/** Price for the requested visit start. */
export async function getEntryPriceCents(at: Date): Promise<number> {
  return (await getEntryPrice(at)).priceCents;
}

/**
 * Resolve what a member's next entry costs: 0 if it's their free entry,
 * otherwise the current entry price.
 */
export async function priceForNextEntry(
  userId: string,
  at: Date,
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

/**
 * The loyalty sentence for a confirmed order of several slots, where "this
 * was your Nth visit" would be wrong. Call it with the status after the
 * order is counted and the number of the order's free slots. Empty for a
 * guest, like `loyaltyProgressSentence`.
 */
export function orderLoyaltySentence(
  status: LoyaltyStatus,
  freeInOrder: number,
): string {
  if (status.totalEntries <= 0) return "";
  const counted = `Se započtením této objednávky máte ${status.totalEntries} ${pluralEntries(status.totalEntries)}.`;
  const free =
    freeInOrder === 1
      ? " Jeden termín v ní máte zdarma jako věrnostní vstup."
      : freeInOrder > 1
        ? ` ${freeInOrder} termíny v ní máte zdarma jako věrnostní vstupy.`
        : "";
  const next = status.nextEntryIsFree
    ? " Příští vstup máte zdarma."
    : ` Do dalšího vstupu zdarma ${entriesRemainingPhrase(status.entriesUntilFree)}.`;
  return `${counted}${free}${next}`;
}

/** Active claim numbers prevent an older cancellation from reissuing a reward. */
export async function hasClaimedReward(
  userId: string,
  reward: number,
  executor: DatabaseExecutor = db,
) {
  const [row] = await executor
    .select({ id: reservation.id })
    .from(reservation)
    .where(
      and(
        eq(reservation.userId, userId),
        eq(reservation.loyaltyReward, reward),
        ne(reservation.status, "cancelled"),
      ),
    )
    .limit(1);
  return Boolean(row);
}
