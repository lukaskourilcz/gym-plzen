/**
 * Banner shown on admin screens that are currently displaying demo data
 * (from DummyJSON) because the real database has no rows yet. Makes it obvious
 * the content is fake while reviewing the UI.
 */
export function DemoBanner() {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        background: "#fff7ed",
        color: "#9a3412",
        borderRadius: 8,
        padding: "0.6rem 0.8rem",
        fontSize: "0.85rem",
        margin: "0 0 1rem",
      }}
    >
      🧪 <strong>Ukázková data</strong> (DummyJSON) — reálná data se zobrazí po
      připojení databáze a prvních rezervacích.
    </div>
  );
}
