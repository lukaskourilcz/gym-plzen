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
  billingProfileSchema,
  sitePhotosSchema,
  type BillingProfileValues,
  type SitePhotosValues,
} from "@/lib/validations/settings";
import {
  HERO_IMAGE_ALT_KEY,
  HERO_IMAGE_URL_KEY,
  SECTIONS_IMAGE_URL_KEY,
  LOGO_URL_KEY,
  SMS_ACCESS_TEMPLATE_KEY,
  TERMS_URL_KEY,
  GALLERY_IMAGE_URL_KEYS,
  ILLUSTRATIVE_PHOTOS_KEY,
  zoneImageUrlKey,
} from "@/lib/config/branding";
import { HERO_PREVIEW_DAYS_KEY, clampHeroPreviewDays } from "@/lib/config/hero";
import { cms, invoices, media } from "@/lib/services";
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

/** Gallery and zone photographs, plus the illustrative-photo label. */
const saveSitePhotosImpl = defineAction({
  schema: sitePhotosSchema,
  authorize: assertAdmin,
  handler: async ({ gallery, zones, illustrative }, admin) => {
    await Promise.all([
      ...GALLERY_IMAGE_URL_KEYS.map((key, index) =>
        cms.setSetting(key, gallery[index] ?? "", admin.id),
      ),
      ...zones.map((url, index) =>
        cms.setSetting(zoneImageUrlKey(index + 1), url ?? "", admin.id),
      ),
      cms.setSetting(ILLUSTRATIVE_PHOTOS_KEY, illustrative, admin.id),
    ]);
    revalidatePath("/admin/settings");
    revalidatePath("/");
    revalidatePath("/vybaveni");
  },
});

export async function saveSitePhotosAction(
  input: SitePhotosValues,
): Promise<Result<unknown>> {
  return saveSitePhotosImpl(input);
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

/**
 * The operator's billing details, plus the switch that turns automatic sending
 * on. Saving with the switch on but a field missing is not an error : the
 * settings page lists what is still needed, and the issuing service simply
 * does not issue until the profile is complete.
 */
const saveBillingProfileImpl = defineAction({
  schema: billingProfileSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const { sendDocuments, ...profile } = input;
    await invoices.saveBillingProfile(
      {
        ...profile,
        bankAccount: profile.bankAccount ?? "",
        registryNote: profile.registryNote ?? "",
      },
      admin.id,
    );
    await invoices.setSendingEnabled(sendDocuments, admin.id);
    revalidatePath("/admin/settings");
    revalidatePath("/admin/doklady");
  },
});

export async function saveBillingProfileAction(
  input: BillingProfileValues,
): Promise<Result<unknown>> {
  return saveBillingProfileImpl(input);
}
