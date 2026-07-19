import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/#jak-to-funguje", label: "Jak to funguje" },
  { href: "/#cenik", label: "Ceník" },
  { href: "/#prostor", label: "Prostor" },
  { href: "/#pravidla", label: "Řád" },
  { href: "/#kontakt", label: "Kontakt" },
];

/** Public site header with brand, section nav, and the primary CTA. */
export function SiteHeader({ brand = "NAMASTÉ Private Gym", logoUrl }: { brand?: string; logoUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <Container className="flex h-[68px] items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-[17px] font-extrabold tracking-[-0.02em]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={brand} className="h-8 w-auto" />
          ) : (
            <span className="grid size-[34px] place-items-center rounded-[9px] bg-ink text-primary">
              <Dumbbell className="size-5" />
            </span>
          )}
          <span className="uppercase">{brand}</span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-semibold text-muted-foreground md:flex">
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
          <Button href="/rezervace" size="sm" variant="ink" className="text-primary">
            Rezervovat →
          </Button>
        </div>
      </Container>
    </header>
  );
}
