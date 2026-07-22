export default function Loading() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-[60vh] max-w-[1200px] px-5 py-16"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Načítání stránky</span>
      <div className="h-4 w-28 animate-pulse bg-muted" />
      <div className="mt-5 h-14 max-w-2xl animate-pulse bg-muted" />
      <div className="mt-10 h-72 animate-pulse bg-muted" />
    </main>
  );
}
