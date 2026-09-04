"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  entryPriceSchema,
  promoPriceSchema,
  type EntryPriceValues,
  type PromoPriceValues,
} from "@/lib/validations/memberships";
import {
  ENTRY_PRICE_SETTING_KEY,
  PROMO_ENDS_AT_SETTING_KEY,
  PROMO_PRICE_SETTING_KEY,
  PROMO_STARTS_AT_SETTING_KEY,
} from "@/lib/config/pricing";
import { cms } from "@/lib/services";
import { localInputToInstant } from "@/lib/helpers/datetime";

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
  },
});

export async function setEntryPriceAction(
  input: EntryPriceValues,
): Promise<Result<unknown>> {
  return setEntryPriceImpl(input);
}

/**
 * Set or clear the promotional window.
 *
 * The form sends `datetime-local` strings, which carry no zone. The server
 * interprets them in the gym's timezone, so "1. 10. 00:00" means Prague
 * midnight regardless of where the administrator is sitting.
 */
const setPromoPriceImpl = defineAction({
  schema: promoPriceSchema,
  authorize: assertAdmin,
  handler: async ({ priceCzk, startsAt, endsAt }, admin) => {
    const clearing = priceCzk == null || !startsAt || !endsAt;
    await Promise.all([
      cms.setSetting(
        PROMO_PRICE_SETTING_KEY,
        clearing ? null : Math.round(priceCzk * 100),
        admin.id,
      ),
      cms.setSetting(
        PROMO_STARTS_AT_SETTING_KEY,
        clearing ? "" : localInputToInstant(startsAt).toISOString(),
        admin.id,
      ),
      cms.setSetting(
        PROMO_ENDS_AT_SETTING_KEY,
        clearing ? "" : localInputToInstant(endsAt).toISOString(),
        admin.id,
      ),
    ]);
    revalidatePath("/admin/memberships");
    // The public price is rendered from this setting.
    revalidatePath("/");
  },
});

export async function setPromoPriceAction(
  input: PromoPriceValues,
): Promise<Result<unknown>> {
  return setPromoPriceImpl(input);
}
