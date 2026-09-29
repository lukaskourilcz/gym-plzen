import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/site/brand";
import {
  entriesRemainingPhrase,
  loyaltyFilledSegments,
  type LoyaltyStatus,
} from "@/lib/services/loyalty";

/**
 * Customer-facing loyalty widget. Shows how many entries the member has and how
 * many remain until their next free entry. Presentational only : pass a
 * `LoyaltyStatus` (from `loyalty.getLoyaltyStatus`). It is the lead element of
 * the account page, so it uses the brand ink surface with gold progress.
 */
export function LoyaltyWidget({ status }: { status: LoyaltyStatus }) {
  const { entriesUntilFree, cadence, nextEntryIsFree } = status;
  const filled = loyaltyFilledSegments(status);

  return (
    <div className="relative h-full overflow-hidden rounded-lg bg-ink p-8 text-ink-foreground sm:p-10">
      <BrandMark
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
            Do vstupu zdarma{" "}
            <strong className="text-gold">
              {entriesRemainingPhrase(entriesUntilFree)}
            </strong>
            .
          </p>
        )}

        <p className="mt-3 text-sm text-ink-foreground/80">
          Každý {cadence}. vstup je zdarma. Počítáme je automaticky, nemusíte
          nic hlídat.
        </p>

        {/*
         * Two presentations of the same number: the approved segment bar and
         * the modern ring. Both are rendered and CSS reveals one, so the page
         * stays variant-neutral for the cache. The hidden one is `display:
         * none`, which also keeps it out of the accessibility tree.
         *
         * Both are decorative: the sentence above already states the status.
         */}
        <div data-loyalty="segments" className="mt-7 flex gap-2">
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

        <LoyaltyRing filled={filled} cadence={cadence} />

        <div className="mt-7 grid gap-4 border-t border-white/12 pt-6 sm:grid-cols-2">
          <div>
            <div className="text-3xl font-extrabold">{status.totalEntries}</div>
            <div className="mt-1 text-xs text-ink-foreground/80">
              započítaných vstupů
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

/** Geometry of the modern progress ring. */
const RING_SIZE = 132;
const RING_STROKE = 10;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * The modern variant's gold progress ring. Decorative: the sentence above the
 * widget already carries the exact status, so this is hidden from assistive
 * technology rather than repeating it as a second, clumsier announcement.
 *
 * The sweep animates from empty via a keyframe whose target is a custom
 * property; the global reduced-motion rule collapses its duration, landing it
 * on the final value straight away.
 */
function LoyaltyRing({ filled, cadence }: { filled: number; cadence: number }) {
  const progress = cadence > 0 ? Math.min(filled / cadence, 1) : 0;
  const offset = RING_CIRCUMFERENCE * (1 - progress);

  return (
    <div
      data-loyalty="ring"
      aria-hidden="true"
      className="mt-7 w-[132px] shrink-0"
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="size-[132px] -rotate-90"
          role="presentation"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            className="stroke-white/25"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            className="animate-[loyalty-ring_700ms_var(--ease-brand)_both] stroke-gold"
            style={
              {
                strokeDasharray: RING_CIRCUMFERENCE,
                strokeDashoffset: offset,
                "--ring-circumference": `${RING_CIRCUMFERENCE}`,
                "--ring-offset": `${offset}`,
              } as React.CSSProperties
            }
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-2xl font-extrabold tabular-nums text-gold">
            {filled}/{cadence}
          </span>
        </div>
      </div>
    </div>
  );
}
