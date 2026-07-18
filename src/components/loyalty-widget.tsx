import type { LoyaltyStatus } from "@/lib/services/loyalty";

/**
 * Customer-facing loyalty widget. Shows how many entries the member has and how
 * many remain until their next free entry. Presentational only — pass a
 * `LoyaltyStatus` (from `loyalty.getLoyaltyStatus`). Styling is intentionally
 * minimal; the final visual design comes later.
 */
export function LoyaltyWidget({ status }: { status: LoyaltyStatus }) {
  const { positionInCycle, entriesUntilFree, cadence, nextEntryIsFree } = status;
  const filled = nextEntryIsFree ? cadence : positionInCycle;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "1rem",
        maxWidth: 340,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>Věrnostní program</div>

      {nextEntryIsFree ? (
        <p style={{ color: "var(--ok)", fontWeight: 600 }}>
          🎉 Váš další vstup je zdarma!
        </p>
      ) : (
        <p>
          Do vstupu zdarma zbývá{" "}
          <strong>
            {entriesUntilFree} {pluralEntries(entriesUntilFree)}
          </strong>
          .
        </p>
      )}

      {/* Progress dots — one per entry in the current cycle. */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: "0.5rem" }}>
        {Array.from({ length: cadence }, (_, i) => (
          <span
            key={i}
            aria-hidden
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              background: i < filled ? "var(--accent)" : "transparent",
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.5rem" }}>
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
