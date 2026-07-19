import { db } from "@/lib/db";
import { contentBlock, siteSetting } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/helpers/logger";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  FREE_ENTRY_EVERY,
} from "@/lib/config/pricing";
import { LOGO_URL_KEY, TERMS_URL_KEY } from "@/lib/config/branding";

/**
 * Public-site content, resilient by design. The marketing site reads copy from
 * the CMS (`content_block`), but must still render before the database is
 * provisioned or seeded — so this loader overlays any CMS values on top of
 * sensible Czech defaults and NEVER throws (a DB error falls back to defaults).
 *
 * Every key here is editable in the admin under "Obsah webu".
 */

export const SITE_DEFAULTS = {
  "brand.name": "NAMASTÉ Private Gym",
  "home.hero.badge": "Privátní fitness v Plzni",
  "home.hero.title": "Celý gym jen pro vás",
  "home.hero.subtitle":
    "Pronajměte si celý prostor pro sebe nebo vezměte přátele. Bez čekání na stroje a bez cizích pohledů.",
  "home.hero.cta": "Zobrazit volné termíny",
  "home.about.title": "Jak to funguje",
  "home.about.step1.title": "Vyberte termín",
  "home.about.step1.body":
    "V rezervačním systému si vyberete termín a časové okno, které vám vyhovuje.",
  "home.about.step2.title": "Zaplaťte online",
  "home.about.step2.body": "Rezervaci potvrdíte platbou kartou přímo na webu.",
  "home.about.step3.title": "Odemkněte a trénujte",
  "home.about.step3.body":
    "Před začátkem rezervace obdržíte osobní kód, kterým si odemknete vstupní dveře.",
  "home.pricing.title": "Cena vstupu",
  "home.pricing.note":
    "Bez závazků a měsíčních plateb. Platíte jen za to, co si odtrénujete.",
  "home.rules.title": "Provozní řád",
  "home.rules.body":
    "Do fitness vstupujte pouze v čase rezervace. Po tréninku vraťte vybavení i dětský koutek do původního stavu a otřete použité nářadí. Vstupní kód je osobní a platí pouze ve vašem časovém okně.",
  "home.gallery.title": "Prostor",
  "home.contact.title": "Kontakt",
  "contact.address": "Křížkova 424/23, 301 00 Plzeň 1",
  "contact.phone": "+420 777 000 000",
  "contact.email": "info@gymplzen.cz",
} as const;

export type SiteContentKey = keyof typeof SITE_DEFAULTS;

export interface SiteContent {
  get: (key: SiteContentKey) => string;
  entryPriceCents: number;
  freeEntryEvery: number;
  logoUrl: string | null;
  termsUrl: string | null;
}

/** Load all public content once (overlay CMS values on defaults). Never throws. */
export async function loadSiteContent(locale = "cs"): Promise<SiteContent> {
  const values: Record<string, string> = { ...SITE_DEFAULTS };
  let entryPriceCents = DEFAULT_ENTRY_PRICE_CENTS;
  let logoUrl: string | null = null;
  let termsUrl: string | null = null;

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
    }
  } catch (e) {
    // DB not provisioned/reachable yet — fall back to defaults so the public
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
  };
}
