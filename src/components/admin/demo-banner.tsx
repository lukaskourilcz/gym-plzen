/**
 * Banner shown on admin screens currently displaying demo data (DummyJSON)
 * because the real database has no rows yet.
 */
export function DemoBanner() {
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
      🧪 <strong>Ukázková data</strong> (DummyJSON) — reálná data se zobrazí po
      připojení databáze a prvních rezervacích.
    </div>
  );
}
