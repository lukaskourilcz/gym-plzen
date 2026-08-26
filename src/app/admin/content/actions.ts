"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  editPublicTextSchema,
  type EditPublicTextValues,
} from "@/lib/validations/cms";
import { cms } from "@/lib/services";
import {
  getContentEditorItem,
  isEditableContentKey,
} from "@/lib/content/editor";
import { ActionError } from "@/lib/helpers/action";

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
    revalidatePath("/");
    revalidatePath("/faq");
    revalidatePath("/vybaveni");
    revalidatePath("/provozni-rad");
    revalidatePath("/admin/content");
  },
});

export async function savePublicTextAction(
  input: EditPublicTextValues,
): Promise<Result<unknown>> {
  return savePublicTextImpl(input);
}
