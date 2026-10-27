import {
  deriveLoyaltyStatus,
  pluralEntries,
  entriesRemainingPhrase,
} from "@/lib/helpers/loyalty-display";
export {
  deriveLoyaltyStatus,
  loyaltyFilledSegments,
  pluralEntries,
  entriesRemainingPhrase,
} from "@/lib/helpers/loyalty-display";
import { and, count, eq, inArray, isNotNull, ne, gt, lte } from "drizzle-orm";
import { db, type DatabaseExecutor } from "@/lib/db";
import {
  reservation,
  openingHours,
  siteSetting,
  pricingPeriod,
} from "@/lib/db/schema";
import {
  BLOCK_PRICING_KEY,
  parseBlockPrices,
} from "@/lib/config/block-pricing";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  FREE_ENTRY_EVERY,
  resolveEntryPrice,
  type EntryPrice,
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
export async function getEntryPrices(
  ats: readonly Date[],
): Promise<EntryPrice[]> {
  if (!ats.length) return [];
  const valid = ats.filter(
    (at) => at instanceof Date && Number.isFinite(at.getTime()),
  );
  const min = valid.length
    ? new Date(Math.min(...valid.map((at) => at.getTime())))
    : null;
  const max = valid.length
    ? new Date(Math.max(...valid.map((at) => at.getTime())))
    : null;
  const [settings, hours, periods] = await Promise.all([
    db
      .select({ key: siteSetting.key, value: siteSetting.value })
      .from(siteSetting)
      .where(
        inArray(siteSetting.key, [ENTRY_PRICE_SETTING_KEY, BLOCK_PRICING_KEY]),
      ),
    db.select().from(openingHours),
    min && max
      ? db
          .select({
            name: pricingPeriod.name,
            priceCents: pricingPeriod.priceCents,
            startsAt: pricingPeriod.startsAt,
            endsAt: pricingPeriod.endsAt,
          })
          .from(pricingPeriod)
          .where(
            and(
              gt(pricingPeriod.endsAt, min),
              lte(pricingPeriod.startsAt, max),
            ),
          )
      : [],
  ]);
  const stored = new Map(settings.map((row) => [row.key, row.value]));
  const price = stored.get(ENTRY_PRICE_SETTING_KEY);
  const standardPriceCents =
    typeof price === "number" && price >= 0 ? price : DEFAULT_ENTRY_PRICE_CENTS;
  const blockPrices = parseBlockPrices(stored.get(BLOCK_PRICING_KEY));
  return ats.map((at) =>
    resolveEntryPrice({ standardPriceCents, periods, blockPrices, hours, at }),
  );
}

export async function getEntryPrice(at: Date): Promise<EntryPrice> {
  return (await getEntryPrices([at]))[0]!;
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
 * One Czech sentence about the member's loyalty progress, for the confirmation
 * e-mail and the confirmation page. Returns an empty string when there is
 * nothing truthful to say : a guest booking has no account to count against, so
 * the surrounding template must collapse the empty paragraph.
 *
 * Call it with the status *after* the reservation being confirmed is counted.
 * Confirmed future bookings count, so the visit may not have happened yet:
 * the sentence speaks of counted entries, not of past visits. Whether this
 * entry was the free one comes from the reservation itself when known (a
 * reward can be skipped when two checkouts raced), otherwise from the cycle.
 */
export function loyaltyProgressSentence(
  status: LoyaltyStatus,
  thisEntryFree: boolean = status.positionInCycle === 0,
): string {
  const { totalEntries, entriesUntilFree, cadence } = status;
  if (totalEntries <= 0) return "";

  const entry = `Toto je váš ${totalEntries}. započítaný vstup`;

  if (thisEntryFree) {
    return `${entry} a máte ho zdarma. Další vstup zdarma vás čeká po ${cadence} vstupech.`;
  }
  if (status.nextEntryIsFree) {
    return `${entry}. Příští vstup máte zdarma.`;
  }
  return `${entry}, do vstupu zdarma ${entriesRemainingPhrase(entriesUntilFree)}.`;
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
