import { cn } from "@/lib/utils";
import type { LoyaltyStatus } from "@/lib/services/loyalty";

/**
 * Customer-facing loyalty widget. Shows how many entries the member has and how
 * many remain until their next free entry. Presentational only : pass a
 * `LoyaltyStatus` (from `loyalty.getLoyaltyStatus`).
 */
export function LoyaltyWidget({ status }: { status: LoyaltyStatus }) {
  const { positionInCycle, entriesUntilFree, cadence, nextEntryIsFree } =
    status;
  const filled = nextEntryIsFree ? cadence : positionInCycle;

  return (
    <div className="h-full overflow-hidden rounded-lg bg-ink p-7 text-white">
      <div className="text-[11px] font-extrabold uppercase tracking-[.13em] text-white/60">
        Věrnostní program
      </div>

      {nextEntryIsFree ? (
        <p className="mt-3 text-xl font-black text-gold">
          Váš další vstup je zdarma!
        </p>
      ) : (
        <p className="mt-3 text-xl font-black">
          Do vstupu zdarma zbývá{" "}
          <strong className="text-gold">
            {entriesUntilFree} {pluralEntries(entriesUntilFree)}
          </strong>
          .
        </p>
      )}

      <div className="mt-5 flex gap-1.5">
        {Array.from({ length: cadence }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              "h-2.5 flex-1 rounded-sm border border-white/20",
              i < filled && "border-gold bg-gold",
            )}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-white/10 pt-4 text-xs text-white/65">
        Celkem návštěv: {status.totalEntries} · vstupů zdarma získáno:{" "}
        {status.freeEntriesEarned}
      </div>
    </div>
  );
}

/** Czech pluralisation for "vstup" (1 / 2–4 / 5+). */
function pluralEntries(n: number): string {
  if (n === 1) return "vstup";
  if (n >= 2 && n <= 4) return "vstupy";
  return "vstupů";
}
