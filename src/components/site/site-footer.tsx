import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { BrandLockup } from "@/components/site/brand";
import {
  FacebookIcon,
  InstagramIcon,
  WhatsAppIcon,
} from "@/components/site/social-icons";
import { PUBLIC_NAV } from "@/lib/config/navigation";
import { CookieSettingsButton } from "@/components/site/cookie-settings-button";

/*
 * Compact 36px rows on touch and 28px from `lg`: both stay above the WCAG 2.2
 * AA 24px target-size floor while keeping the mobile footer short.
 */
const footerLink =
  "flex min-h-9 items-center text-sm leading-5 text-ink-foreground/75 transition-colors hover:text-ink-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:min-h-7";

export function SiteFooter({
  brand = "NAVI Private Gym",
  email,
  phone,
  secondaryPhone,
  address,
  facebookUrl,
  instagramUrl,
  whatsappUrl,
}: {
  brand?: string;
  email?: string;
  phone?: string;
  secondaryPhone?: string;
  address?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  whatsappUrl?: string;
}) {
  const year = new Date().getFullYear();
  /** Render the street, locality and postcode on separate lines. */
  const addressLines = (() => {
    if (!address) return [];
    const [street, ...rest] = address.split(",").map((part) => part.trim());
    const tail = rest.join(", ");
    const postcode = tail.match(/\d{3}\s?\d{2}/)?.[0];
    const city = postcode
      ? tail
          .replace(postcode, "")
          .replace(/^\s*,\s*|\s*,\s*$/g, "")
          .trim()
      : tail;
    if (!tail) return [street];
    return postcode
      ? [street, city, postcode].filter(Boolean)
      : [street, city].filter(Boolean);
  })();
  const socials = [
    facebookUrl
      ? { href: facebookUrl, label: "Facebook", Icon: FacebookIcon }
      : null,
    instagramUrl
      ? { href: instagramUrl, label: "Instagram", Icon: InstagramIcon }
      : null,
    whatsappUrl
      ? { href: whatsappUrl, label: "WhatsApp", Icon: WhatsAppIcon }
      : null,
  ].filter((item) => item !== null);
  const socialLinks = () => (
    <ul className="mt-2 flex items-center gap-2">
      {socials.map(({ href, label, Icon }) => (
        <li key={label}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label}, ${brand}`}
            /* A subtle outlined circle gives every official brand silhouette
               the same visual weight. */
            className="grid size-11 place-items-center rounded-full border border-gold/45 bg-white/5 text-gold transition-colors hover:border-gold hover:bg-gold hover:text-gold-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <Icon />
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <footer className="border-t border-white/10 bg-ink text-ink-foreground">
      <Container className="grid gap-10 py-12 md:grid-cols-[1fr_2fr] lg:py-10">
        <div className="text-center md:text-left">
          <BrandLockup className="items-start text-left text-gold" />
          <p className="mt-6 text-xs leading-6 text-ink-foreground/75">
            © {year} {brand}
            <br />
            Soukromý prostor pro nerušený trénink v Plzni.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:gap-6">
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
              {secondaryPhone ? (
                <a
                  href={`tel:${secondaryPhone.replace(/\s/g, "")}`}
                  className={footerLink}
                >
                  {secondaryPhone}
                </a>
              ) : null}
              {email ? (
                <a href={`mailto:${email}`} className={footerLink}>
                  {email}
                </a>
              ) : null}
              {address ? (
                <p className="py-2 text-sm leading-6 text-ink-foreground/75">
                  {/* Street, locality and postcode each get their own line. */}
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              ) : null}
              {!phone && !secondaryPhone && !email ? (
                <p className="py-2 text-sm leading-6 text-ink-foreground/75">
                  Kontaktní údaje doplní provozovatel.
                </p>
              ) : null}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-extrabold">Informace</h2>
            <div className="mt-2 grid">
              <Link href="/doprava-a-platba" className={footerLink}>
                Doprava a platba
              </Link>
              <Link href="/provozni-rad" className={footerLink}>
                Provozní řád
              </Link>
              <Link href="/obchodni-podminky" className={footerLink}>
                Obchodní podmínky
              </Link>
              <Link href="/ochrana-soukromi" className={footerLink}>
                Ochrana soukromí
              </Link>
              <CookieSettingsButton
                className={`${footerLink} w-fit cursor-pointer appearance-none border-0 bg-transparent p-0 text-left`}
              />
            </div>
            {socials.length > 0 ? (
              <div className="mt-5 hidden sm:block">
                <h3 className="text-sm font-extrabold">Sledujte nás</h3>
                {socialLinks()}
              </div>
            ) : null}
          </div>
          {socials.length > 0 ? (
            <div className="sm:hidden">
              <h2 className="text-sm font-extrabold">Sledujte nás</h2>
              {socialLinks()}
            </div>
          ) : null}
        </div>
      </Container>
      <Container className="border-t border-white/10 py-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
          <a
            href="https://www.comgate.eu/cs/platebni-brana"
            aria-label="Platební brána Comgate"
          >
            <Image
              src="/cg-ithor.svg"
              width={259}
              height={60}
              alt="Comgate"
              className="h-auto w-40"
            />
          </a>
          <Image
            src="/Visa_Brandmark_White_RGB_2021.svg"
            width={3385}
            height={2078}
            alt="Visa"
            className="h-auto w-32"
          />
          <Image
            src="/mc_symbol.svg"
            width={152}
            height={108}
            alt="Mastercard"
            className="h-auto w-24"
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-ink-foreground/75">
          Platby kartami Visa a Mastercard připravujeme — čekají na aktivaci.{" "}
          <Link
            href="/doprava-a-platba"
            className="underline underline-offset-4"
          >
            Informace o platbách
          </Link>
        </p>
      </Container>
    </footer>
  );
}
