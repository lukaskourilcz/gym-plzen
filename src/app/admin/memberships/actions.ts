"use server";

import { revalidatePath } from "next/cache";
import {
  saveBlockPriceSchema,
  deleteBlockPriceSchema,
  saveParticipantPricingSchema,
  setParticipantsEnabledSchema,
  type SaveBlockPriceValues,
  type SaveParticipantPricingValues,
} from "@/lib/validations/pricing";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  deletePricingPeriodSchema,
  entryPriceSchema,
  pricingPeriodSchema,
  type EntryPriceValues,
  type PricingPeriodValues,
} from "@/lib/validations/memberships";
import { ENTRY_PRICE_SETTING_KEY } from "@/lib/config/pricing";
import {
  BOOKING_HORIZON_SETTING_KEY,
  clampBookingHorizonDays,
} from "@/lib/config/schedule";
import { activity, cms, pricingPeriods, blockPricing } from "@/lib/services";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { addDaysToDateKey, localDateTimeToDate } from "@/lib/helpers/datetime";
import {
  bookingHorizonSchema,
  type BookingHorizonValues,
} from "@/lib/validations/settings";

/**
 * Every public surface that quotes the entry price or the running promotion.
 * The CMS pages are ISR, so without this an admin price change would wait for
 * their next scheduled regeneration.
 */
const PRICED_PUBLIC_PATHS = [
  "/",
  "/rezervace",
  "/faq",
  "/doprava-a-platba",
] as const;

function revalidatePricedPages() {
  for (const path of PRICED_PUBLIC_PATHS) revalidatePath(path);
}

/**
 * Pricing admin action. The gym sells a single one-time entry (no
 * subscriptions), so the only editable commercial setting is the entry price,
 * stored under `pricing.entry_price_cents` (converted from Kč to haléř here).
 */
const setEntryPriceImpl = defineAction({
  schema: entryPriceSchema,
  authorize: assertAdmin,
  handler: async ({ priceCzk }, admin) => {
    await cms.setSetting(
      ENTRY_PRICE_SETTING_KEY,
      Math.round(priceCzk * 100),
      admin.id,
    );
    await activity.record({
      action: "settings.price_saved",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: `Standardní cena vstupu nastavena na ${formatMoney(Math.round(priceCzk * 100))}.`,
    });
    revalidatePath("/admin/memberships");
    revalidatePricedPages();
  },
});

export async function setEntryPriceAction(
  input: EntryPriceValues,
): Promise<Result<unknown>> {
  return setEntryPriceImpl(input);
}

/** Keep the bookable future range beside the price periods it enables. */
const saveBookingHorizonImpl = defineAction({
  schema: bookingHorizonSchema,
  authorize: assertAdmin,
  handler: async ({ horizonDays }, admin) => {
    await cms.setSetting(
      BOOKING_HORIZON_SETTING_KEY,
      clampBookingHorizonDays(horizonDays),
      admin.id,
    );
    revalidatePath("/admin/memberships");
    revalidatePath("/rezervace");
  },
});

export async function saveBookingHorizonAction(
  input: BookingHorizonValues,
): Promise<Result<unknown>> {
  return saveBookingHorizonImpl(input);
}

/**
 * Insert or edit a price period.
 *
 * Form dates are inclusive Prague calendar days. Persistence uses a half-open
 * [start, end) range, with the exclusive end at midnight after the last day.
 */
const savePricingPeriodImpl = defineAction({
  schema: pricingPeriodSchema,
  authorize: assertAdmin,
  handler: async ({ id, name, priceCzk, startsOn, endsOn }, admin) => {
    const saved = await pricingPeriods.savePricingPeriod({
      id,
      name,
      priceCents: Math.round(priceCzk * 100),
      startsAt: localDateTimeToDate(startsOn, 0),
      endsAt: localDateTimeToDate(addDaysToDateKey(endsOn, 1), 0),
      adminId: admin.id,
    });
    await activity.record({
      action: "settings.pricing_period_saved",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: `Cenové období „${saved.name}“ ${formatMoney(saved.priceCents)} od ${formatDateTime(saved.startsAt)} do ${formatDateTime(new Date(saved.endsAt.getTime() - 60_000))} uloženo.`,
      context: { pricingPeriodId: saved.id },
    });
    revalidatePath("/admin/memberships");
    revalidatePricedPages();
  },
});

export async function savePricingPeriodAction(
  input: PricingPeriodValues,
): Promise<Result<unknown>> {
  return savePricingPeriodImpl(input);
}

const deletePricingPeriodImpl = defineAction({
  schema: deletePricingPeriodSchema,
  authorize: assertAdmin,
  handler: async ({ id }, admin) => {
    await pricingPeriods.deletePricingPeriod(id);
    await activity.record({
      action: "settings.pricing_period_deleted",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: "Cenové období smazáno.",
      context: { pricingPeriodId: id },
    });
    revalidatePath("/admin/memberships");
    revalidatePricedPages();
  },
});

export async function deletePricingPeriodAction(input: {
  id: string;
}): Promise<Result<unknown>> {
  return deletePricingPeriodImpl(input);
}

const saveBlockImpl = defineAction({
  schema: saveBlockPriceSchema,
  authorize: assertAdmin,
  handler: async ({ priceCzk, ...range }, admin) => {
    await blockPricing.saveBlockPrice(
      { ...range, priceCents: priceCzk * 100 },
      admin.id,
    );
    await activity.record({
      action: "settings.block_price_saved",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: "Cena časových bloků uložena.",
      context: range,
    });
    revalidatePath("/admin/memberships");
    revalidatePricedPages();
  },
});
export async function saveBlockPriceAction(
  input: SaveBlockPriceValues,
): Promise<Result<unknown>> {
  return saveBlockImpl(input);
}
const deleteBlockImpl = defineAction({
  schema: deleteBlockPriceSchema,
  authorize: assertAdmin,
  handler: async ({ id }, admin) => {
    await blockPricing.deleteBlockPrice(id, admin.id);
    await activity.record({
      action: "settings.block_price_deleted",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: "Cena časových bloků odebrána.",
    });
    revalidatePath("/admin/memberships");
    revalidatePricedPages();
  },
});
export async function deleteBlockPriceAction(input: {
  id: string;
}): Promise<Result<unknown>> {
  return deleteBlockImpl(input);
}
const saveParticipantsImpl = defineAction({
  schema: saveParticipantPricingSchema,
  authorize: assertAdmin,
  handler: async ({ priceCzk, mode }, admin) => {
    await blockPricing.saveParticipantPricing(
      { amountCents: priceCzk * 100, mode },
      admin.id,
    );
    await activity.record({
      action: "settings.participant_price_saved",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: `Příplatek za doprovod ${formatMoney(priceCzk * 100)}, ${mode === "flat" ? "jednotně za doprovod" : "za každou osobu"}.`,
    });
    revalidatePath("/admin/memberships");
    revalidatePath("/account");
    revalidatePricedPages();
  },
});
export async function saveParticipantPricingAction(
  input: SaveParticipantPricingValues,
): Promise<Result<unknown>> {
  return saveParticipantsImpl(input);
}

const setParticipantsEnabledImpl = defineAction({
  schema: setParticipantsEnabledSchema,
  authorize: assertAdmin,
  handler: async ({ enabled }, admin) => {
    await blockPricing.setParticipantsEnabled(enabled, admin.id);
    await activity.record({
      action: "settings.participants_toggled",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      summary: enabled
        ? "Doprovod a příplatky zapnuty."
        : "Doprovod a příplatky vypnuty.",
    });
    revalidatePath("/admin", "layout");
    revalidatePath("/account", "layout");
    revalidatePath("/rezervace", "layout");
    revalidatePricedPages();
  },
});
export async function setParticipantsEnabledAction(input: {
  enabled: boolean;
}): Promise<Result<unknown>> {
  return setParticipantsEnabledImpl(input);
}
