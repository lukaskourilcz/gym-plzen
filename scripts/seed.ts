/**
 * Seed baseline data: opening hours, starter CMS content blocks, and the
 * default entry price. Idempotent — safe to run repeatedly.
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

// Mon–Fri 06:00–22:00, Sat–Sun 08:00–20:00, 60-minute slots.
const OPENING_HOURS = [
  { dayOfWeek: 0, openMinute: 8 * 60, closeMinute: 20 * 60, isClosed: 0 },
  { dayOfWeek: 1, openMinute: 6 * 60, closeMinute: 22 * 60, isClosed: 0 },
  { dayOfWeek: 2, openMinute: 6 * 60, closeMinute: 22 * 60, isClosed: 0 },
  { dayOfWeek: 3, openMinute: 6 * 60, closeMinute: 22 * 60, isClosed: 0 },
  { dayOfWeek: 4, openMinute: 6 * 60, closeMinute: 22 * 60, isClosed: 0 },
  { dayOfWeek: 5, openMinute: 6 * 60, closeMinute: 22 * 60, isClosed: 0 },
  { dayOfWeek: 6, openMinute: 8 * 60, closeMinute: 20 * 60, isClosed: 0 },
];

const CONTENT_BLOCKS = [
  { key: "home.hero.title", label: "Nadpis úvodní sekce", groupName: "home", valueText: "Vítejte v našem gymu" },
  { key: "home.hero.subtitle", label: "Podnadpis úvodní sekce", groupName: "home", valueText: "Rezervujte si trénink online." },
  { key: "rules.body", label: "Provozní řád", groupName: "pravidla", valueText: "Sem doplňte provozní řád." },
  { key: "contact.address", label: "Adresa", groupName: "kontakt", valueText: "Plzeň" },
  { key: "contact.phone", label: "Telefon", groupName: "kontakt", valueText: "" },
  { key: "contact.email", label: "E-mail", groupName: "kontakt", valueText: "" },
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
    .values({ key: ENTRY_PRICE_SETTING_KEY, value: DEFAULT_ENTRY_PRICE_CENTS })
    .onConflictDoNothing({ target: siteSetting.key });
  console.log("✅ Default entry price seeded.");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
