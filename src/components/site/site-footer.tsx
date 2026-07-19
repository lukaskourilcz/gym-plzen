import Link from "next/link";
import { Container } from "@/components/ui/container";

/** Public site footer. */
export function SiteFooter({
  brand = "NAMASTÉ Private Gym",
  email,
  phone,
  termsUrl,
}: {
  brand?: string;
  email?: string;
  phone?: string;
  termsUrl?: string | null;
}) {
  const year = 2026; // Date.now() is unavailable in this sandbox; bump on release.
  return (
    <footer className="border-t border-border bg-ink text-ink-foreground">
      <Container className="flex flex-col gap-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-bold">{brand}</div>
          <p className="mt-1 max-w-xs text-sm text-ink-foreground/70">
            Privátní fitness v Plzni. Celý prostor pro vás, rezervace online a vstup vlastním kódem.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-ink-foreground/90">Web</span>
            <Link href="/#jak-to-funguje" className="text-ink-foreground/70 hover:text-ink-foreground">
              Jak to funguje
            </Link>
            <Link href="/#cenik" className="text-ink-foreground/70 hover:text-ink-foreground">
              Ceník
            </Link>
            <Link href="/rezervace" className="text-ink-foreground/70 hover:text-ink-foreground">
              Rezervace
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-semibold text-ink-foreground/90">Kontakt</span>
            {email && (
              <a href={`mailto:${email}`} className="text-ink-foreground/70 hover:text-ink-foreground">
                {email}
              </a>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="text-ink-foreground/70 hover:text-ink-foreground">
                {phone}
              </a>
            )}
            <Link href="/login" className="text-ink-foreground/70 hover:text-ink-foreground">
              Přihlášení
            </Link>
            {termsUrl && (
              <a href={termsUrl} target="_blank" rel="noopener noreferrer" className="text-ink-foreground/70 hover:text-ink-foreground">
                Obchodní podmínky
              </a>
            )}
          </div>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-1 py-4 text-xs text-ink-foreground/50 sm:flex-row sm:justify-between">
          <span>
            © {year} {brand}. Všechna práva vyhrazena.
          </span>
          <span>Rezervace a platba online</span>
        </Container>
      </div>
    </footer>
  );
}
