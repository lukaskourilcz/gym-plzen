import type { Metadata } from "next";
import { inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/guards";
import { readDatabase } from "@/lib/db/read";
import { openingHours, pricingPeriod, siteSetting } from "@/lib/db/schema";
import { loadSiteContent, FAQ_NUMBERS } from "@/lib/content/site";
import {
  BLOCK_PRICING_KEY,
  parseBlockPrices,
} from "@/lib/config/block-pricing";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
} from "@/lib/config/pricing";
import {
  PARTICIPANTS_ENABLED_KEY,
  PARTICIPANT_PRICING_KEY,
  parseParticipantPricing,
  parseParticipantsEnabled,
} from "@/lib/config/participants";
import { CustomerPreview } from "./customer-preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ukázkový zákaznický náhled",
  robots: { index: false, follow: false },
};

export default async function CustomerPreviewPage() {
  // Authenticate before reading configuration. Never create a shared member or
  // impersonation cookie; the operator retains their existing admin session.
  await requireAdmin();
  const [snapshot, content] = await Promise.all([
    readDatabase(async (tx) => {
      const [hours, periods, settings] = await Promise.all([
        tx.select().from(openingHours),
        tx
          .select({
            priceCents: pricingPeriod.priceCents,
            startsAt: pricingPeriod.startsAt,
            endsAt: pricingPeriod.endsAt,
          })
          .from(pricingPeriod),
        tx
          .select({ key: siteSetting.key, value: siteSetting.value })
          .from(siteSetting)
          .where(
            inArray(siteSetting.key, [
              BLOCK_PRICING_KEY,
              ENTRY_PRICE_SETTING_KEY,
              PARTICIPANTS_ENABLED_KEY,
              PARTICIPANT_PRICING_KEY,
            ]),
          ),
      ]);
      return { hours, periods, settings };
    }),
    loadSiteContent(),
  ]);
  const settings = new Map(snapshot.settings.map((s) => [s.key, s.value]));
  const price = settings.get(ENTRY_PRICE_SETTING_KEY);
  return (
    <CustomerPreview
      config={{
        nowISO: new Date().toISOString(),
        hours: snapshot.hours,
        periods: snapshot.periods.map((p) => ({
          ...p,
          startsAt: p.startsAt.toISOString(),
          endsAt: p.endsAt.toISOString(),
        })),
        blockPrices: parseBlockPrices(settings.get(BLOCK_PRICING_KEY)),
        standardPriceCents:
          typeof price === "number" && price > 0
            ? price
            : DEFAULT_ENTRY_PRICE_CENTS,
        participants: {
          ...parseParticipantPricing(settings.get(PARTICIPANT_PRICING_KEY)),
          enabled: parseParticipantsEnabled(
            settings.get(PARTICIPANTS_ENABLED_KEY),
          ),
        },
        brand: content.get("brand.name"),
        subtitle: content.get("home.hero.subtitle"),
        faq: FAQ_NUMBERS.map((n) => ({
          question: content.get(`faq.${n}.question`),
          answer: content.get(`faq.${n}.answer`),
        })),
        equipment: ([1, 2, 3, 4, 5, 6] as const).map((n) => ({
          title: content.get(`equipment.zone${n}.title`),
          body: content.get(`equipment.zone${n}.body`),
        })),
      }}
    />
  );
}
