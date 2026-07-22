import Link from "next/link";
import { Container } from "@/components/ui/container";
import { BrandLogo } from "@/components/site/brand";

const footerLink =
  "flex min-h-11 items-center text-sm text-ink-foreground/75 transition-colors hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

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
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 bg-ink text-ink-foreground">
      <Container className="grid gap-12 py-14 md:grid-cols-[1.2fr_2fr]">
        <div>
          <BrandLogo inverse className="min-h-12" />
          <p className="mt-5 max-w-sm text-sm leading-6 text-ink-foreground/60">
            Soukromý prostor pro nerušený trénink v Plzni. Termín vyberete
            online a po potvrzení dostanete pokyny ke vstupu.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <h2 className="text-sm font-extrabold">Návštěva</h2>
            <div className="mt-3 grid">
              <Link href="/rezervace" className={footerLink}>
                Rezervace
              </Link>
              <Link href="/vybaveni" className={footerLink}>
                Vybavení
              </Link>
              <Link href="/faq" className={footerLink}>
                Časté dotazy
              </Link>
              <Link href="/#kontakt" className={footerLink}>
                Kde nás najdete
              </Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Účet</h2>
            <div className="mt-3 grid">
              <Link href="/login" className={footerLink}>
                Přihlášení
              </Link>
              <Link href="/account" className={footerLink}>
                Moje rezervace
              </Link>
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Informace</h2>
            <div className="mt-3 grid">
              {email ? (
                <a href={`mailto:${email}`} className={footerLink}>
                  {email}
                </a>
              ) : null}
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className={footerLink}
                >
                  {phone}
                </a>
              ) : null}
              {termsUrl ? (
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={footerLink}
                >
                  Obchodní podmínky
                </a>
              ) : (
                <Link href="/obchodni-podminky" className={footerLink}>
                  Obchodní podmínky
                </Link>
              )}
              <Link href="/ochrana-soukromi" className={footerLink}>
                Ochrana soukromí
              </Link>
            </div>
          </div>
        </div>
      </Container>
      <div className="border-t border-white/10">
        <Container className="flex flex-col gap-2 py-5 text-xs text-ink-foreground/60 sm:flex-row sm:justify-between">
          <span>
            © {year} {brand}
          </span>
          <span>Online rezervace a bezpečná platba</span>
        </Container>
      </div>
    </footer>
  );
}
