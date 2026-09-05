/** Banner for the explicit, local-only, read-only administration preview. */
export function DemoBanner() {
  return (
    <div className="mb-5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
      <strong>Ukázkový režim.</strong> Zobrazená data jsou ilustrační a změny
      jsou vypnuté.
    </div>
  );
}
