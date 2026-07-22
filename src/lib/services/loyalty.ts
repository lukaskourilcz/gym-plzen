import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservation } from "@/lib/db/schema";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  FREE_ENTRY_EVERY,
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
  /** Entries remaining until the next free one. 0 means the next entry is free. */
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
  const entriesUntilFree =
    (FREE_ENTRY_EVERY - positionInCycle) % FREE_ENTRY_EVERY;
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

/** The current entry price (admin override, falling back to the default). */
export async function getEntryPriceCents(): Promise<number> {
  const override = await getSetting<number>(ENTRY_PRICE_SETTING_KEY);
  return typeof override === "number" && override >= 0
    ? override
    : DEFAULT_ENTRY_PRICE_CENTS;
}

/**
 * Resolve what a member's next entry costs: 0 if it's their free entry,
 * otherwise the current entry price.
 */
export async function priceForNextEntry(
  userId: string,
): Promise<{ priceCents: number; isFree: boolean }> {
  const [status, price] = await Promise.all([
    getLoyaltyStatus(userId),
    getEntryPriceCents(),
  ]);
  return status.nextEntryIsFree
    ? { priceCents: 0, isFree: true }
    : { priceCents: price, isFree: false };
}
