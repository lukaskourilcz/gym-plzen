import { unstable_cache } from "next/cache";
import { inArray } from "drizzle-orm";
import { readDatabase } from "@/lib/db/read";
import { siteSetting } from "@/lib/db/schema";
import { logger } from "@/lib/helpers/logger";
import {
  defaultPublicNotices,
  NOTICE_IDS,
  NOTICE_CACHE_TAG,
  noticeSettingKey,
  parseNoticeFields,
  type PublicNotices,
} from "@/lib/config/public-notices";

/** Select only public copy, never unrelated settings, contacts or provider credentials. */
export async function loadPublicNotices(): Promise<PublicNotices> {
  const rows = await readDatabase((db) =>
    db
      .select({ key: siteSetting.key, value: siteSetting.value })
      .from(siteSetting)
      .where(inArray(siteSetting.key, NOTICE_IDS.map(noticeSettingKey))),
  );
  return Object.fromEntries(
    NOTICE_IDS.map((id) => [
      id,
      parseNoticeFields(
        id,
        rows.find((r) => r.key === noticeSettingKey(id))?.value,
      ),
    ]),
  ) as PublicNotices;
}
const cached = unstable_cache(loadPublicNotices, ["public-notices-v1"], {
  revalidate: 60,
  tags: [NOTICE_CACHE_TAG],
});
export async function getPublicNotices(): Promise<PublicNotices> {
  try {
    return await cached();
  } catch (error) {
    logger.warn("Public notice copy unavailable; using defaults", {
      error: String(error),
    });
    return defaultPublicNotices();
  }
}
