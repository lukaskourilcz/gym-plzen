import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAsset } from "@/lib/db/schema";
import type { MediaAsset } from "@/lib/db/types";
import { uploadMedia } from "@/lib/integrations/supabase";

/**
 * Media service — uploads a CMS file to Supabase Storage and records its
 * metadata. Storage path is derived deterministically so re-uploads with the
 * same name land predictably.
 */

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
}

/** Upload bytes + create the media_asset row. Returns the record. */
export async function uploadAsset(input: {
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer | Buffer;
  sizeBytes?: number;
  alt?: string | null;
  uploadedByAdminId?: string | null;
}): Promise<MediaAsset> {
  const cleaned = safeFileName(input.fileName);
  const path = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${cleaned}`;

  await uploadMedia({
    path,
    body: input.bytes,
    contentType: input.mimeType,
  });

  const [row] = await db
    .insert(mediaAsset)
    .values({
      storagePath: path,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes ?? null,
      alt: input.alt ?? null,
      uploadedByAdminId: input.uploadedByAdminId ?? null,
    })
    .returning();
  return row!;
}

export async function listAssets(limit = 200): Promise<MediaAsset[]> {
  return db
    .select()
    .from(mediaAsset)
    .orderBy(desc(mediaAsset.createdAt))
    .limit(limit);
}

export async function getAsset(id: string): Promise<MediaAsset | null> {
  const [row] = await db
    .select()
    .from(mediaAsset)
    .where(eq(mediaAsset.id, id))
    .limit(1);
  return row ?? null;
}
