"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import { setSetting } from "@/lib/services/cms";
import {
  NOTICE_CACHE_TAG,
  noticeSettingKey,
  saveNoticeSchema,
} from "@/lib/config/public-notices";

const saveNotice = defineAction({
  schema: saveNoticeSchema,
  authorize: assertAdmin,
  handler: async ({ id, fields }, admin) => {
    // One allowlisted public-copy row only. No reservation or delivery service.
    await setSetting(noticeSettingKey(id), fields, admin.id);
    revalidateTag(NOTICE_CACHE_TAG);
    revalidatePath("/", "layout");
    return fields;
  },
});
export async function saveNoticeAction(input: unknown) {
  return saveNotice(input);
}
