"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import { ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  brandingSchema,
  heroPreviewSchema,
  smsTemplateSchema,
  type BrandingValues,
  type HeroPreviewValues,
  type SmsTemplateValues,
  bookingHorizonSchema,
  type BookingHorizonValues,
} from "@/lib/validations/settings";
import {
  HERO_IMAGE_ALT_KEY,
  HERO_IMAGE_URL_KEY,
  SECTIONS_IMAGE_URL_KEY,
  LOGO_URL_KEY,
  SMS_ACCESS_TEMPLATE_KEY,
  TERMS_URL_KEY,
} from "@/lib/config/branding";
import { HERO_PREVIEW_DAYS_KEY, clampHeroPreviewDays } from "@/lib/config/hero";
import {
  BOOKING_HORIZON_SETTING_KEY,
  clampBookingHorizonDays,
} from "@/lib/config/schedule";
import { cms, media } from "@/lib/services";
import { publicMediaUrl } from "@/lib/integrations/supabase";
import { logger } from "@/lib/helpers/logger";

/** Save branding URLs (logo, terms PDF). */
const saveBrandingImpl = defineAction({
  schema: brandingSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await cms.setSetting(LOGO_URL_KEY, input.logoUrl ?? "", admin.id);
    await cms.setSetting(TERMS_URL_KEY, input.termsUrl ?? "", admin.id);
    await cms.setSetting(
      HERO_IMAGE_URL_KEY,
      input.heroImageUrl ?? "",
      admin.id,
    );
    await cms.setSetting(
      HERO_IMAGE_ALT_KEY,
      input.heroImageAlt ?? "",
      admin.id,
    );
    await cms.setSetting(
      SECTIONS_IMAGE_URL_KEY,
      input.sectionsImageUrl ?? "",
      admin.id,
    );
    revalidatePath("/admin/settings");
    revalidatePath("/");
  },
});

/** Save the SMS access-code template. */
const saveSmsTemplateImpl = defineAction({
  schema: smsTemplateSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await cms.setSetting(
      SMS_ACCESS_TEMPLATE_KEY,
      input.template ?? "",
      admin.id,
    );
    revalidatePath("/admin/settings");
  },
});

/** Save the number of days shown in the homepage availability preview. */
const saveHeroPreviewImpl = defineAction({
  schema: heroPreviewSchema,
  authorize: assertAdmin,
  handler: async ({ previewDays }, admin) => {
    await cms.setSetting(
      HERO_PREVIEW_DAYS_KEY,
      clampHeroPreviewDays(previewDays),
      admin.id,
    );
    revalidatePath("/admin/settings");
    revalidatePath("/");
  },
});

export async function saveBrandingAction(
  input: BrandingValues,
): Promise<Result<unknown>> {
  return saveBrandingImpl(input);
}

/** How far ahead visitors may book. Raised for a promotion, lowered after. */
const saveBookingHorizonImpl = defineAction({
  schema: bookingHorizonSchema,
  authorize: assertAdmin,
  handler: async ({ horizonDays }, admin) => {
    await cms.setSetting(
      BOOKING_HORIZON_SETTING_KEY,
      clampBookingHorizonDays(horizonDays),
      admin.id,
    );
    revalidatePath("/admin/settings");
    revalidatePath("/rezervace");
  },
});

export async function saveBookingHorizonAction(
  input: BookingHorizonValues,
): Promise<Result<unknown>> {
  return saveBookingHorizonImpl(input);
}

export async function saveHeroPreviewAction(
  input: HeroPreviewValues,
): Promise<Result<unknown>> {
  return saveHeroPreviewImpl(input);
}

export async function saveSmsTemplateAction(
  input: SmsTemplateValues,
): Promise<Result<unknown>> {
  return saveSmsTemplateImpl(input);
}

/**
 * Upload a file (logo, terms PDF, gallery image) to Supabase Storage and return
 * its public URL. Takes FormData (a File under `file`). Requires Supabase to be
 * configured (see NEEDED.md); returns a clear error otherwise.
 */
export async function uploadFileAction(
  formData: FormData,
): Promise<Result<{ url: string; fileName: string }>> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Nemáte oprávnění." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Vyberte prosím soubor." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Soubor je příliš velký (max. 8 MB)." };
  }

  try {
    const admin = await assertAdmin();
    const bytes = Buffer.from(await file.arrayBuffer());
    const asset = await media.uploadAsset({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
      sizeBytes: file.size,
      uploadedByAdminId: admin.id,
    });
    const url = publicMediaUrl(asset.storagePath);
    revalidatePath("/admin/settings");
    return { ok: true, data: { url, fileName: file.name } };
  } catch (e) {
    logger.error(e, { where: "uploadFileAction" });
    const message =
      e instanceof ActionError
        ? e.message
        : "Nahrání selhalo. Zkontrolujte, že je nastaveno úložiště Supabase (viz NEEDED.md).";
    return { ok: false, error: message };
  }
}
