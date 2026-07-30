import Link from "next/link";
import { Container } from "@/components/ui/container";
import { BrandLockup } from "@/components/site/brand";
import { FacebookIcon, InstagramIcon } from "@/components/site/social-icons";
import { PUBLIC_NAV } from "@/lib/config/navigation";

/*
 * 44px targets on touch, 28px from `lg` where the pointer is precise: a stacked
 * link list at 44px made the footer needlessly tall. 28px still clears the WCAG
 * 2.2 AA 24px target-size floor. Documented in docs/DESIGN_SYSTEM.md.
 */
const footerLink =
  "flex min-h-11 items-center text-sm text-ink-foreground/75 transition-colors hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:min-h-7";

export function SiteFooter({
  brand = "NAMASTÉ Private Gym",
  email,
  phone,
  address,
  facebookUrl,
  instagramUrl,
  termsUrl,
}: {
  brand?: string;
  email?: string;
  phone?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  termsUrl?: string | null;
}) {
  const year = new Date().getFullYear();
  /*
   * "Křížkova 424/23, 301 00 Plzeň 1" renders as street / city, with the
   * postcode moved in front of the city the way Czech addresses are written.
   */
  const addressLines = (() => {
    if (!address) return [];
    const [street, ...rest] = address.split(",").map((part) => part.trim());
    const tail = rest.join(", ");
    const postcode = tail.match(/\d{3}\s?\d{2}/)?.[0];
    const city = postcode ? tail.replace(postcode, "").trim() : tail;
    if (!tail) return [street];
    return [street, postcode ? `${city}, ${postcode}` : city];
  })();
  const socials = [
    facebookUrl
      ? { href: facebookUrl, label: "Facebook", Icon: FacebookIcon }
      : null,
    instagramUrl
      ? { href: instagramUrl, label: "Instagram", Icon: InstagramIcon }
      : null,
  ].filter((item) => item !== null);

  return (
    <footer className="border-t border-white/10 bg-ink text-ink-foreground">
      <Container className="grid gap-10 py-12 md:grid-cols-[1fr_2fr] lg:py-10">
        <div>
          <BrandLockup inverse className="items-start text-left" />
          <p className="mt-6 text-xs leading-6 text-ink-foreground/75">
            © {year} {brand}
            <br />
            Soukromý prostor pro nerušený trénink v Plzni.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3 lg:gap-6">
          <div>
            <h2 className="text-sm font-extrabold">Menu</h2>
            <div className="mt-2 grid">
              {PUBLIC_NAV.map((item) => (
                <Link key={item.href} href={item.href} className={footerLink}>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Kontakt</h2>
            <div className="mt-2 grid">
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className={footerLink}
                >
                  {phone}
                </a>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className={footerLink}>
                  {email}
                </a>
              ) : null}
              {address ? (
                <p className="py-2 text-sm leading-6 text-ink-foreground/75">
                  {/* Street on one line, city and postcode on the next. */}
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              ) : null}
              {!phone && !email ? (
                <p className="py-2 text-sm leading-6 text-ink-foreground/75">
                  Kontaktní údaje doplní provozovatel.
                </p>
              ) : null}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Informace</h2>
            <div className="mt-2 grid">
              <Link href="/provozni-rad" className={footerLink}>
                Provozní řád
              </Link>
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
            {socials.length > 0 ? (
              <div className="mt-5">
                <h3 className="text-sm font-extrabold">Sledujte nás</h3>
                <ul className="mt-2 flex items-center gap-2">
                  {socials.map(({ href, label, Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${label}, ${brand}`}
                        className="grid size-11 place-items-center rounded-sm text-ink-foreground/75 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                      >
                        <Icon />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </Container>
    </footer>
  );
}
