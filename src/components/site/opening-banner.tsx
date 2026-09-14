import Link from "next/link";

export function OpeningBanner() {
  return (
    <aside
      aria-label="Otevření a akční vstupné"
      className="bg-gold px-4 py-3 text-center text-gold-foreground"
    >
      <Link
        href="/#cenik"
        className="block text-sm font-extrabold leading-6 sm:text-base"
      >
        OTEVÍRÁME 1. 10. • VSTUP 199 Kč PO CELÝ ŘÍJEN
      </Link>
      <p className="mt-1 text-xs leading-5">
        Zarezervujte si svůj termín již teď.
      </p>
    </aside>
  );
}
