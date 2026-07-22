"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  upsertBlockSchema,
  type UpsertBlockValues,
} from "@/lib/validations/cms";
import { cms } from "@/lib/services";

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
