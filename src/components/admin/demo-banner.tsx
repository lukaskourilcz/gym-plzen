/**
 * Banner shown on admin screens currently displaying demo data (DummyJSON)
 * because the real database has no rows yet.
 */
export function DemoBanner() {
  return (
    <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
      <strong>Režim ukázky.</strong> Na této stránce jsou pro prezentaci zobrazená vzorová data.
    </div>
  );
}
