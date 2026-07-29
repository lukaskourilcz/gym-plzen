/**
 * Seed baseline data: opening hours, starter CMS content blocks, and the
 * default entry price. Idempotent : safe to run repeatedly.
 *
 *   npm run db:seed
 */
import "./_env";
import { db } from "../src/lib/db";
import { contentBlock, openingHours, siteSetting } from "../src/lib/db/schema";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
} from "../src/lib/config/pricing";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SHOWER_MINUTES,
  DEFAULT_SLOT_MINUTES,
  SHOWER_MINUTES_SETTING_KEY,
} from "../src/lib/config/schedule";
import { SITE_DEFAULTS, type SiteContentKey } from "../src/lib/content/site";

// Seed the neutral defaults from the shared schedule configuration.
const OPENING_HOURS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openMinute: DEFAULT_OPEN_MINUTE,
  closeMinute: DEFAULT_CLOSE_MINUTE,
  isClosed: 0,
}));

/**
 * Blocks the operator edits in "Obsah webu". Values come from `SITE_DEFAULTS`
 * so the seeded row always matches what the site renders before it is edited.
 */
const seeded = (key: SiteContentKey, label: string, groupName: string) => ({
  key,
  label,
  groupName,
  valueText: SITE_DEFAULTS[key],
});

const CONTENT_BLOCKS = [
  seeded("brand.name", "Název", "home"),
  seeded("home.hero.title", "Nadpis úvodní sekce", "home"),
  seeded("home.hero.subtitle", "Podnadpis úvodní sekce", "home"),
  seeded("home.about.title", "Nadpis sekce Jak to u nás funguje", "home"),
  seeded("home.about.step1.title", "Krok 1 : nadpis", "home"),
  seeded("home.about.step1.body", "Krok 1 : text", "home"),
  seeded("home.about.step2.title", "Krok 2 : nadpis", "home"),
  seeded("home.about.step2.body", "Krok 2 : text", "home"),
  seeded("home.about.step3.title", "Krok 3 : nadpis", "home"),
  seeded("home.about.step3.body", "Krok 3 : text", "home"),
  seeded("home.about.step4.title", "Krok 4 : nadpis", "home"),
  seeded("home.about.step4.body", "Krok 4 : text", "home"),
  seeded("home.about.step5.title", "Krok 5 : nadpis", "home"),
  seeded("home.about.step5.body", "Krok 5 : text", "home"),
  seeded("home.about.step6.title", "Krok 6 : nadpis", "home"),
  seeded("home.about.step6.body", "Krok 6 : text", "home"),
  seeded("home.pricing.note", "Poznámka u ceníku", "home"),
  seeded("home.cta.title", "Závěrečná výzva k rezervaci", "home"),
  seeded("home.rules.title", "Provozní řád : nadpis", "pravidla"),
  seeded("home.rules.body", "Provozní řád : text", "pravidla"),
  seeded("contact.facebook", "Facebook (URL)", "kontakt"),
  seeded("contact.instagram", "Instagram (URL)", "kontakt"),
  seeded("contact.address", "Adresa", "kontakt"),
  seeded("contact.phone", "Telefon", "kontakt"),
  seeded("contact.email", "E-mail", "kontakt"),
];

async function main() {
  for (const row of OPENING_HOURS) {
    await db
      .insert(openingHours)
      .values({ ...row, slotMinutes: DEFAULT_SLOT_MINUTES })
      .onConflictDoNothing({ target: openingHours.dayOfWeek });
  }
  console.log(`✅ Opening hours seeded (${OPENING_HOURS.length} days).`);

  for (const block of CONTENT_BLOCKS) {
    await db
      .insert(contentBlock)
      .values({ ...block, locale: "cs", type: "text" })
      .onConflictDoNothing();
  }
  console.log(`✅ Content blocks seeded (${CONTENT_BLOCKS.length}).`);

  await db
    .insert(siteSetting)
    .values([
      { key: ENTRY_PRICE_SETTING_KEY, value: DEFAULT_ENTRY_PRICE_CENTS },
      { key: SHOWER_MINUTES_SETTING_KEY, value: DEFAULT_SHOWER_MINUTES },
    ])
    .onConflictDoNothing({ target: siteSetting.key });
  console.log("✅ Default settings seeded (entry price, shower grace).");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
