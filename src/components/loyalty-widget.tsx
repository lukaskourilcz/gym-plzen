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
    <div className="relative h-full overflow-hidden rounded-[18px] bg-ink p-7 text-white">
      <div className="absolute inset-0 opacity-20 [background:radial-gradient(60%_60%_at_80%_0%,var(--color-primary),transparent_60%)]" />
      <div className="relative text-[11px] font-extrabold uppercase tracking-[.13em] text-white/50">Věrnostní program</div>

      {nextEntryIsFree ? (
        <p className="relative mt-3 text-xl font-black text-primary">Váš další vstup je zdarma!</p>
      ) : (
        <p className="relative mt-3 text-xl font-black">
          Do vstupu zdarma zbývá{" "}
          <strong className="text-primary">
            {entriesUntilFree} {pluralEntries(entriesUntilFree)}
          </strong>
          .
        </p>
      )}

      <div className="relative mt-5 flex gap-1.5">
        {Array.from({ length: cadence }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn("h-2.5 flex-1 rounded-full border border-white/20", i < filled && "border-primary bg-primary")}
          />
        ))}
      </div>

      <div className="relative mt-4 border-t border-white/10 pt-4 text-xs text-white/55">
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
