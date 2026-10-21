import { FREE_ENTRY_EVERY } from "@/lib/config/pricing";
import type { LoyaltyStatus } from "@/lib/services/loyalty";
export type { LoyaltyStatus } from "@/lib/services/loyalty";

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
