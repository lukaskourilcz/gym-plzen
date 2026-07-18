import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/#jak-to-funguje", label: "Jak to funguje" },
  { href: "/#cenik", label: "Ceník" },
  { href: "/#galerie", label: "Galerie" },
  { href: "/#pravidla", label: "Řád" },
  { href: "/#kontakt", label: "Kontakt" },
];

/** Public site header with brand, section nav, and the primary CTA. */
export function SiteHeader({ brand = "Gym Plzeň", logoUrl }: { brand?: string; logoUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} className="h-8 w-auto" />
          ) : (
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Dumbbell className="size-5" />
            </span>
          )}
          {brand}
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Přihlásit
          </Button>
          <Button href="/rezervace" size="sm">
            Rezervovat
          </Button>
        </div>
      </Container>
    </header>
  );
}
