"use server";

import { loadSiteContent, SITE_DEFAULTS } from "@/lib/content/site";
import { contentAssetSchema } from "@/lib/validations/content-asset";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  editPublicTextSchema,
  upsertBlockSchema,
  type EditPublicTextValues,
  type UpsertBlockValues,
} from "@/lib/validations/cms";
import { cms } from "@/lib/services";
import {
  getContentEditorItem,
  isEditableContentKey,
} from "@/lib/content/editor";
import { ActionError } from "@/lib/helpers/action";
import {
  ANNOUNCEMENT_SETTING_KEY,
  announcementSchema,
  type Announcement,
} from "@/lib/config/opening";

const saveAnnouncementImpl = defineAction({
  schema: announcementSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    // A single CMS setting only. No reservation, delivery or code service runs.
    await cms.setSetting(ANNOUNCEMENT_SETTING_KEY, input, admin.id);
    revalidatePath("/");
    revalidatePath("/admin/content");
    return input;
  },
});

export async function saveAnnouncementAction(
  input: Announcement,
): Promise<Result<Announcement>> {
  return saveAnnouncementImpl(input);
}

/**
 * CMS content-block save action. Upserts a block by (key, locale). The public
 * site reads these blocks, so we revalidate the home route on save.
 */
const saveImpl = defineAction({
  schema: upsertBlockSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await cms.upsertBlock({
      key: input.key,
      locale: input.locale,
      type: input.type,
      valueText: input.valueText || null,
      label: input.label || null,
      groupName: input.groupName || null,
      sortOrder: input.sortOrder,
      mediaId: input.mediaId ?? null,
      updatedByAdminId: admin.id,
    });
    revalidatePath("/admin/content");
    revalidatePath("/");
  },
});

export async function saveBlockAction(
  input: UpsertBlockValues,
): Promise<Result<unknown>> {
  return saveImpl(input);
}

/** Save a known public text without exposing CMS implementation details. */
const savePublicTextImpl = defineAction({
  schema: editPublicTextSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    if (!isEditableContentKey(input.key)) {
      throw new ActionError("Tento text nelze v administraci upravit.");
    }
    const metadata = getContentEditorItem(input.key);
    await cms.upsertBlock({
      key: input.key,
      locale: "cs",
      type: "text",
      valueText: input.valueText,
      label: metadata.label,
      groupName: metadata.section,
      updatedByAdminId: admin.id,
    });
    // Contact details sit in every footer, so every CMS-backed page refreshes.
    for (const path of [
      "/",
      "/faq",
      "/vybaveni",
      "/provozni-rad",
      "/obchodni-podminky",
      "/ochrana-soukromi",
      "/doprava-a-platba",
      "/admin/content",
    ])
      revalidatePath(path);
    const content = await loadSiteContent("cs", { strict: true });
    return {
      texts: Object.fromEntries(
        Object.keys(SITE_DEFAULTS).map((key) => [
          key,
          content.get(key as keyof typeof SITE_DEFAULTS),
        ]),
      ),
    };
  },
});

export async function savePublicTextAction(
  input: EditPublicTextValues,
): Promise<Result<{ texts: Record<string, string> }>> {
  return savePublicTextImpl(input);
}

const saveContentAssetImpl = defineAction({
  schema: contentAssetSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    await cms.setSetting(input.key, input.value, admin.id);
    for (const path of ["/", "/vybaveni", "/admin/content", "/admin/settings"])
      revalidatePath(path);
  },
});

/** One whitelisted asset per save; never overwrite another section's image. */
export async function saveContentAssetAction(input: {
  key: string;
  value: string;
}): Promise<Result<unknown>> {
  return saveContentAssetImpl(input);
}
