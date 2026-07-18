"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { entryPriceSchema, type EntryPriceValues } from "@/lib/validations/memberships";
import { ENTRY_PRICE_SETTING_KEY } from "@/lib/config/pricing";
import { cms } from "@/lib/services";

/**
 * Pricing admin action. The gym sells a single one-time entry (no
 * subscriptions), so the only editable commercial setting is the entry price,
 * stored under `pricing.entry_price_cents` (converted from Kč to haléř here).
 */
const setEntryPriceImpl = defineAction({
  schema: entryPriceSchema,
  authorize: assertAdmin,
  handler: async ({ priceCzk }, admin) => {
    await cms.setSetting(ENTRY_PRICE_SETTING_KEY, Math.round(priceCzk * 100), admin.id);
    revalidatePath("/admin/memberships");
  },
});

export async function setEntryPriceAction(
  input: EntryPriceValues,
): Promise<Result<unknown>> {
  return setEntryPriceImpl(input);
}
