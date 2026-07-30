import { db } from "@/lib/db";
import { contentBlock, siteSetting } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/helpers/logger";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  FREE_ENTRY_EVERY,
} from "@/lib/config/pricing";
import {
  HERO_IMAGE_ALT_KEY,
  HERO_IMAGE_URL_KEY,
  SECTIONS_IMAGE_URL_KEY,
  LOGO_URL_KEY,
  TERMS_URL_KEY,
} from "@/lib/config/branding";

/**
 * Public-site content, resilient by design. The marketing site reads copy from
 * the CMS (`content_block`), but must still render before the database is
 * provisioned or seeded : so this loader overlays any CMS values on top of
 * sensible Czech defaults and NEVER throws (a DB error falls back to defaults).
 *
 * Every key here is editable in the admin under "Obsah webu".
 */

export const SITE_DEFAULTS = {
  "brand.name": "NAMASTÉ Private Gym",
  "home.hero.badge": "Privátní fitness v Plzni",
  "home.hero.title": "Tvůj čas. Tvůj prostor. Tvoje Namasté.",
  "home.hero.subtitle":
    "Rezervujte si prémiové soukromé samoobslužné fitness v Plzni.",
  "home.hero.cta": "Zobrazit volné termíny",
  "home.about.title": "Jak to u nás funguje",
  "home.about.step1.title": "Vyber si termín",
  "home.about.step1.body":
    "V rezervačním systému si vyber termín a časové okno, ve kterém chceš přijít zacvičit si. Potvrď, že ses seznámil s naším provozním řádem a obchodními podmínkami, a vyplň rezervaci.",
  "home.about.step2.title": "Po zaplacení",
  "home.about.step2.body":
    "Ti přijde společně s potvrzením tvojí rezervace veškeré potřebné info ke vstupu do našeho gymu do e-mailu, který jsi zadal při rezervaci.",
  "home.about.step3.title": "Vstup do fitka",
  "home.about.step3.body":
    "Před začátkem tvé rezervace ti přijde do e-mailu a SMS unikátní kód, který zadáš na klávesnici u vstupu do fitness a dveře se ti odemknou. Kód platí pouze v tvém vybraném časovém okně.",
  "home.about.step4.title": "Zacvič si",
  "home.about.step4.body":
    "Po celou dobu tvého tréninku můžeš prostory využívat plně dle svého uvážení. Veškeré stroje a pomůcky jsou ti k dispozici. Pokud si nevíš rady, využij našeho videopomocníka nebo oslov třeba našeho trenéra.",
  "home.about.step5.title": "Úklid",
  "home.about.step5.body":
    "Po tréninku nezapomeň vše po sobě vrátit na své místo a do původního stavu, aby mohl další klient využít vše stejně jako ty. Nezapomeň zkontrolovat i dětský koutek a zahrádku, pokud jsi je využíval. Moc ti za to děkujeme.",
  "home.about.step6.title": "Před odchodem",
  "home.about.step6.body":
    "Můžeš využít koupelnu, kde najdeš sprchu včetně české přírodní kosmetiky. V automatu si můžeš zakoupit své oblíbené suplementy nebo svačinu. Nezapomeň se vyfotit a označit nás na sociálních sítích nebo nás ohodnotit. Budeme se těšit na příště.",
  "home.pricing.title": "Cena vstupu",
  "home.pricing.note":
    "Bez závazků a měsíčních plateb. Platíte jen za to, co si odtrénujete.",
  "home.cta.title": "Připravený na změnu? Přidej se k nám!",
  "home.rules.title": "Provozní řád",
  "home.rules.body":
    "Do fitness vstupujte pouze v čase rezervace. Po tréninku vraťte vybavení do původního stavu a otřete použité nářadí. Vstupní kód je osobní a platí pouze podle pokynů k vaší rezervaci.",
  "home.gallery.title": "Prostor",
  "home.contact.title": "Kontakt",
  "contact.address": "Křížkova 424/23, 301 00 Plzeň 1",
  // PLACEHOLDERS supplied by the client for layout purposes. These are not the
  // real contact details : replace them in the admin before launch.
  "contact.phone": "777 666 555",
  "contact.email": "info@namastegym.cz",
  // PLACEHOLDER network home pages, not the gym's real profiles : replace with
  // the actual page URLs in the admin before launch.
  "contact.facebook": "https://facebook.com",
  "contact.instagram": "https://instagram.com",
} as const;

export type SiteContentKey = keyof typeof SITE_DEFAULTS;

export interface SiteContent {
  get: (key: SiteContentKey) => string;
  entryPriceCents: number;
  freeEntryEvery: number;
  logoUrl: string | null;
  termsUrl: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string;
  /** Photograph pinned behind the operating-steps and pricing bands. */
  sectionsImageUrl: string | null;
}

/** Props every public page hands to `SiteFooter`, derived from CMS content. */
export function footerProps(content: SiteContent) {
  return {
    brand: content.get("brand.name"),
    email: content.get("contact.email").trim() || undefined,
    phone: content.get("contact.phone").trim() || undefined,
    address: content.get("contact.address").trim() || undefined,
    facebookUrl: content.get("contact.facebook").trim() || undefined,
    instagramUrl: content.get("contact.instagram").trim() || undefined,
    termsUrl: content.termsUrl,
  };
}

/** Load all public content once (overlay CMS values on defaults). Never throws. */
export async function loadSiteContent(locale = "cs"): Promise<SiteContent> {
  const values: Record<string, string> = { ...SITE_DEFAULTS };
  let entryPriceCents = DEFAULT_ENTRY_PRICE_CENTS;
  let logoUrl: string | null = null;
  let termsUrl: string | null = null;
  let heroImageUrl: string | null = null;
  let heroImageAlt = "";
  let sectionsImageUrl: string | null = null;

  try {
    const rows = await db
      .select({ key: contentBlock.key, valueText: contentBlock.valueText })
      .from(contentBlock)
      .where(eq(contentBlock.locale, locale));
    for (const row of rows) {
      if (row.valueText != null && row.valueText !== "")
        values[row.key] = row.valueText;
    }

    const settings = await db
      .select({ key: siteSetting.key, value: siteSetting.value })
      .from(siteSetting);
    for (const s of settings) {
      if (s.key === ENTRY_PRICE_SETTING_KEY && typeof s.value === "number")
        entryPriceCents = s.value;
      if (s.key === LOGO_URL_KEY && typeof s.value === "string")
        logoUrl = s.value || null;
      if (s.key === TERMS_URL_KEY && typeof s.value === "string")
        termsUrl = s.value || null;
      if (s.key === HERO_IMAGE_URL_KEY && typeof s.value === "string")
        heroImageUrl = s.value || null;
      if (s.key === HERO_IMAGE_ALT_KEY && typeof s.value === "string")
        heroImageAlt = s.value;
      if (s.key === SECTIONS_IMAGE_URL_KEY && typeof s.value === "string")
        sectionsImageUrl = s.value || null;
    }
  } catch (e) {
    // DB not provisioned/reachable yet : fall back to defaults so the public
    // site still renders on a fresh deploy.
    logger.warn("loadSiteContent: using defaults (DB unavailable)", {
      error: String(e),
    });
  }

  return {
    get: (key) => values[key] ?? SITE_DEFAULTS[key] ?? "",
    entryPriceCents,
    freeEntryEvery: FREE_ENTRY_EVERY,
    logoUrl,
    termsUrl,
    heroImageUrl,
    heroImageAlt,
    sectionsImageUrl,
  };
}
