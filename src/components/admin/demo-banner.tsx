/**
 * Banner shown on admin screens currently displaying demo data (DummyJSON)
 * because the real database has no rows yet.
 */
export function DemoBanner() {
  return (
    <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
      <strong>Ilustrační data.</strong> Skutečné údaje se zobrazí po připojení databáze.
    </div>
  );
}
