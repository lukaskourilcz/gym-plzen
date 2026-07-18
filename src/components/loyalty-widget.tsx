import { cn } from "@/lib/utils";
import type { LoyaltyStatus } from "@/lib/services/loyalty";

/**
 * Customer-facing loyalty widget. Shows how many entries the member has and how
 * many remain until their next free entry. Presentational only — pass a
 * `LoyaltyStatus` (from `loyalty.getLoyaltyStatus`).
 */
export function LoyaltyWidget({ status }: { status: LoyaltyStatus }) {
  const { positionInCycle, entriesUntilFree, cadence, nextEntryIsFree } = status;
  const filled = nextEntryIsFree ? cadence : positionInCycle;

  return (
    <div className="max-w-sm rounded-xl border border-border bg-card p-5">
      <div className="mb-1 font-bold">Věrnostní program</div>

      {nextEntryIsFree ? (
        <p className="font-semibold text-primary">🎉 Váš další vstup je zdarma!</p>
      ) : (
        <p>
          Do vstupu zdarma zbývá{" "}
          <strong>
            {entriesUntilFree} {pluralEntries(entriesUntilFree)}
          </strong>
          .
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {Array.from({ length: cadence }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn("size-4 rounded-full border border-border", i < filled && "bg-primary")}
          />
        ))}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        Celkem návštěv: {status.totalEntries} · vstupů zdarma získáno: {status.freeEntriesEarned}
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
