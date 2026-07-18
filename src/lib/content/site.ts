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
  "brand.name": "Gym Plzeň",
  "home.hero.badge": "Soukromý gym jen pro vás",
  "home.hero.title": "Trénujte sami. Kdykoliv. Bez čekání.",
  "home.hero.subtitle":
    "Rezervujte si celý gym jen pro sebe, zaplaťte online a dveře si otevřete jednorázovým kódem. Žádná recepce, žádné davy.",
  "home.hero.cta": "Rezervovat trénink",
  "home.about.title": "Jak to funguje",
  // Six-step strip (design po vzoru Elysium Gyms: book → pay → code → train).
  "home.about.step1.title": "Vyberte termín",
  "home.about.step1.body": "V živém kalendáři vidíte volné časy. Co si někdo zabere, ostatním okamžitě zmizí.",
  "home.about.step2.title": "Zaplaťte online",
  "home.about.step2.body": "Bezpečně kartou, Apple Pay nebo Google Pay. Bez registračních poplatků.",
  "home.about.step3.title": "Dostanete vstupní kód",
  "home.about.step3.body": "Kód dorazí e-mailem i na WhatsApp. Platí jen v čase vaší rezervace.",
  "home.about.step4.title": "Přijďte v čase rezervace",
  "home.about.step4.body": "Celý gym je v tu chvíli jen váš. Nikdo další se dovnitř nedostane.",
  "home.about.step5.title": "Odemkněte kódem u dveří",
  "home.about.step5.body": "Zadejte kód na klávesnici chytrého zámku Nuki a jste uvnitř.",
  "home.about.step6.title": "Trénujte naplno",
  "home.about.step6.body": "Po tréninku zbývá čas na sprchu. Kód poté vyprší sám — nic nevracíte.",
  "home.pricing.title": "Jednoduché vstupné",
  "home.pricing.note": "Bez závazků a měsíčních plateb. Platíte jen za to, co si odtrénujete.",
  "home.rules.title": "Provozní řád",
  "home.rules.body":
    "Do gymu vstupujte jen v čase své rezervace. Po sobě ukliďte a vydezinfikujte nářadí. Vstupní kód je osobní a jednorázový. Kompletní řád vám dodáme před spuštěním.",
  "home.gallery.title": "Prostor",
  "home.contact.title": "Kontakt",
  "contact.address": "Plzeň (přesná adresa bude doplněna)",
  "contact.phone": "",
  "contact.email": "",
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
      if (row.valueText != null && row.valueText !== "") values[row.key] = row.valueText;
    }

    const settings = await db
      .select({ key: siteSetting.key, value: siteSetting.value })
      .from(siteSetting);
    for (const s of settings) {
      if (s.key === ENTRY_PRICE_SETTING_KEY && typeof s.value === "number") entryPriceCents = s.value;
      if (s.key === LOGO_URL_KEY && typeof s.value === "string") logoUrl = s.value || null;
      if (s.key === TERMS_URL_KEY && typeof s.value === "string") termsUrl = s.value || null;
    }
  } catch (e) {
    // DB not provisioned/reachable yet — fall back to defaults so the public
    // site still renders on a fresh deploy.
    logger.warn("loadSiteContent: using defaults (DB unavailable)", { error: String(e) });
  }

  return {
    get: (key) => values[key] ?? SITE_DEFAULTS[key] ?? "",
    entryPriceCents,
    freeEntryEvery: FREE_ENTRY_EVERY,
    logoUrl,
    termsUrl,
  };
}
