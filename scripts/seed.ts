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
  DEFAULT_SHOWER_MINUTES,
  SHOWER_MINUTES_SETTING_KEY,
} from "../src/lib/config/schedule";

// Open every day 06:00–22:00 with 1-hour slots (see src/lib/config/schedule.ts).
const OPENING_HOURS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openMinute: 6 * 60,
  closeMinute: 22 * 60,
  isClosed: 0,
}));

const CONTENT_BLOCKS = [
  {
    key: "brand.name",
    label: "Název",
    groupName: "home",
    valueText: "NAMASTÉ Private Gym",
  },
  {
    key: "home.hero.title",
    label: "Nadpis úvodní sekce",
    groupName: "home",
    valueText: "Celý gym jen pro vás",
  },
  {
    key: "home.hero.subtitle",
    label: "Podnadpis úvodní sekce",
    groupName: "home",
    valueText: "Pronajměte si celý prostor pro sebe nebo vezměte přátele.",
  },
  {
    key: "rules.body",
    label: "Provozní řád",
    groupName: "pravidla",
    valueText: "Sem doplňte provozní řád.",
  },
  {
    key: "contact.address",
    label: "Adresa",
    groupName: "kontakt",
    valueText: "Křížkova 424/23, 301 00 Plzeň 1",
  },
  {
    key: "contact.phone",
    label: "Telefon",
    groupName: "kontakt",
    valueText: "",
  },
  {
    key: "contact.email",
    label: "E-mail",
    groupName: "kontakt",
    valueText: "",
  },
];

async function main() {
  for (const row of OPENING_HOURS) {
    await db
      .insert(openingHours)
      .values({ ...row, slotMinutes: 60 })
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
