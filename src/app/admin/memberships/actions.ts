"use server";

import { revalidatePath } from "next/cache";
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
import { cms, pricingPeriods } from "@/lib/services";
import { addDaysToDateKey, localDateTimeToDate } from "@/lib/helpers/datetime";
import {
  bookingHorizonSchema,
  type BookingHorizonValues,
} from "@/lib/validations/settings";

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
    revalidatePath("/admin/memberships");
    revalidatePath("/");
    revalidatePath("/rezervace");
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
    await pricingPeriods.savePricingPeriod({
      id,
      name,
      priceCents: Math.round(priceCzk * 100),
      startsAt: localDateTimeToDate(startsOn, 0),
      endsAt: localDateTimeToDate(addDaysToDateKey(endsOn, 1), 0),
      adminId: admin.id,
    });
    revalidatePath("/admin/memberships");
    revalidatePath("/");
    revalidatePath("/rezervace");
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
  handler: async ({ id }) => {
    await pricingPeriods.deletePricingPeriod(id);
    revalidatePath("/admin/memberships");
    revalidatePath("/");
    revalidatePath("/rezervace");
  },
});

export async function deletePricingPeriodAction(input: {
  id: string;
}): Promise<Result<unknown>> {
  return deletePricingPeriodImpl(input);
}
