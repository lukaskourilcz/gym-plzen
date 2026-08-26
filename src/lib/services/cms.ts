import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contentBlock, siteSetting } from "@/lib/db/schema";
import type { ContentBlock } from "@/lib/db/types";
import { publicEnv } from "@/lib/public-env";

/**
 * CMS service : the read/write API behind the "redakční systém". The public
 * site reads content by key; the administration edits it. Content is keyed by
 * (`key`, `locale`) so the same block can carry per-language values.
 */

const DEFAULT_LOCALE = publicEnv.NEXT_PUBLIC_DEFAULT_LOCALE;

/**
 * Upsert a content block by (key, locale). Used by the admin editor's save
 * action. Only the field relevant to the block's `type` should be provided.
 */
export async function upsertBlock(input: {
  key: string;
  locale?: string;
  type?: ContentBlock["type"];
  valueText?: string | null;
  valueJson?: unknown;
  mediaId?: string | null;
  label?: string | null;
  groupName?: string | null;
  sortOrder?: number;
  updatedByAdminId?: string | null;
}): Promise<ContentBlock> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const now = new Date();
  const [row] = await db
    .insert(contentBlock)
    .values({
      key: input.key,
      locale,
      type: input.type ?? "text",
      valueText: input.valueText ?? null,
      valueJson: input.valueJson,
      mediaId: input.mediaId ?? null,
      label: input.label ?? null,
      groupName: input.groupName ?? null,
      sortOrder: input.sortOrder ?? 0,
      updatedByAdminId: input.updatedByAdminId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [contentBlock.key, contentBlock.locale],
      set: {
        type: input.type ?? "text",
        valueText: input.valueText ?? null,
        valueJson: input.valueJson,
        mediaId: input.mediaId ?? null,
        label: input.label ?? null,
        groupName: input.groupName ?? null,
        sortOrder: input.sortOrder ?? 0,
        updatedByAdminId: input.updatedByAdminId ?? null,
        updatedAt: now,
      },
    })
    .returning();
  return row!;
}

// ── Site settings (global key/value) ────────────────────────────────────────

export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  const [row] = await db
    .select()
    .from(siteSetting)
    .where(eq(siteSetting.key, key))
    .limit(1);
  return (row?.value as T) ?? null;
}

export async function setSetting(
  key: string,
  value: unknown,
  updatedByAdminId?: string | null,
): Promise<void> {
  const now = new Date();
  await db
    .insert(siteSetting)
    .values({
      key,
      value,
      updatedByAdminId: updatedByAdminId ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteSetting.key,
      set: {
        value,
        updatedByAdminId: updatedByAdminId ?? null,
        updatedAt: now,
      },
    });
}
