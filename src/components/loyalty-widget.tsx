import { cn } from "@/lib/utils";
import { LotusMark } from "@/components/site/brand";
import type { LoyaltyStatus } from "@/lib/services/loyalty";

/**
 * Customer-facing loyalty widget. Shows how many entries the member has and how
 * many remain until their next free entry. Presentational only : pass a
 * `LoyaltyStatus` (from `loyalty.getLoyaltyStatus`). It is the lead element of
 * the account page, so it uses the brand ink surface with gold progress.
 */
export function LoyaltyWidget({ status }: { status: LoyaltyStatus }) {
  const { positionInCycle, entriesUntilFree, cadence, nextEntryIsFree } =
    status;
  const filled = nextEntryIsFree ? cadence : positionInCycle;

  return (
    <div className="relative h-full overflow-hidden rounded-lg bg-ink p-8 text-ink-foreground sm:p-10">
      <LotusMark
        decorative
        className="pointer-events-none absolute -right-6 -top-6 size-40 text-gold opacity-10"
      />
      <div className="relative">
        <div className="text-xs font-extrabold uppercase tracking-[.14em] text-gold">
          Věrnostní program
        </div>

        {nextEntryIsFree ? (
          <p className="mt-4 text-3xl font-extrabold leading-tight text-gold sm:text-4xl">
            Váš další vstup je zdarma!
          </p>
        ) : (
          <p className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
            Do vstupu zdarma zbývá{" "}
            <strong className="text-gold">
              {entriesUntilFree} {pluralEntries(entriesUntilFree)}
            </strong>
            .
          </p>
        )}

        <p className="mt-3 text-sm text-ink-foreground/80">
          Každý {cadence}. vstup je zdarma. Počítáme je automaticky, nemusíte
          nic hlídat.
        </p>

        <div className="mt-7 flex gap-2">
          {Array.from({ length: cadence }, (_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                "h-3.5 flex-1 rounded-sm border border-white/45",
                i < filled && "border-gold bg-gold",
              )}
            />
          ))}
        </div>

        <div className="mt-7 grid gap-4 border-t border-white/12 pt-6 sm:grid-cols-2">
          <div>
            <div className="text-3xl font-extrabold">{status.totalEntries}</div>
            <div className="mt-1 text-xs text-ink-foreground/80">
              celkem návštěv
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold">
              {status.freeEntriesEarned}
            </div>
            <div className="mt-1 text-xs text-ink-foreground/80">
              vstupů zdarma získáno
            </div>
          </div>
        </div>
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
