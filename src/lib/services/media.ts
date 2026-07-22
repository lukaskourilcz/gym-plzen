import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mediaAsset } from "@/lib/db/schema";
import type { MediaAsset } from "@/lib/db/types";
import { uploadMedia } from "@/lib/integrations/supabase";
import { ActionError } from "@/lib/helpers/action";

function safeFileName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120)
    .toLowerCase();
}

const allowedTypes = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export interface InspectedUpload {
  mimeType: keyof typeof allowedTypes;
  extension: (typeof allowedTypes)[keyof typeof allowedTypes];
  width: number | null;
  height: number | null;
}

/** Verify magic bytes and dimensions instead of trusting browser MIME data. */
export function inspectUpload(
  bytesInput: ArrayBuffer | Buffer,
): InspectedUpload {
  const bytes = Buffer.isBuffer(bytesInput)
    ? bytesInput
    : Buffer.from(bytesInput);
  let mimeType: InspectedUpload["mimeType"] | null = null;
  let width: number | null = null;
  let height: number | null = null;

  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    mimeType = "image/png";
    if (bytes.length >= 24) {
      width = bytes.readUInt32BE(16);
      height = bytes.readUInt32BE(20);
    }
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    mimeType = "image/jpeg";
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1]!;
      const length = bytes.readUInt16BE(offset + 2);
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        height = bytes.readUInt16BE(offset + 5);
        width = bytes.readUInt16BE(offset + 7);
        break;
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  } else if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    mimeType = "image/webp";
    const kind = bytes.subarray(12, 16).toString("ascii");
    if (kind === "VP8X" && bytes.length >= 30) {
      width = 1 + bytes.readUIntLE(24, 3);
      height = 1 + bytes.readUIntLE(27, 3);
    } else if (kind === "VP8 " && bytes.length >= 30) {
      width = bytes.readUInt16LE(26) & 0x3fff;
      height = bytes.readUInt16LE(28) & 0x3fff;
    } else if (kind === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
      const bits = bytes.readUInt32LE(21);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
  } else if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    mimeType = "application/pdf";
  }

  if (!mimeType) {
    throw new ActionError(
      "Povolené jsou pouze skutečné PNG, JPEG, WebP a PDF soubory.",
    );
  }
  if (mimeType.startsWith("image/") && (!width || !height)) {
    throw new ActionError("Rozměry obrázku se nepodařilo bezpečně ověřit.");
  }
  if (
    width &&
    height &&
    (width > 8000 || height > 8000 || width * height > 40_000_000)
  ) {
    throw new ActionError(
      "Obrázek má příliš velké rozměry (max. 8000 px a 40 Mpx).",
    );
  }
  return { mimeType, extension: allowedTypes[mimeType], width, height };
}

export async function uploadAsset(input: {
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer | Buffer;
  sizeBytes?: number;
  alt?: string | null;
  uploadedByAdminId?: string | null;
}): Promise<MediaAsset> {
  const inspected = inspectUpload(input.bytes);
  if (input.mimeType && input.mimeType !== inspected.mimeType) {
    throw new ActionError("Typ souboru neodpovídá jeho obsahu.");
  }
  const baseName =
    safeFileName(input.fileName.replace(/\.[^.]+$/, "")) || "soubor";
  const cleaned = `${baseName}.${inspected.extension}`;
  const path = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}-${cleaned}`;

  await uploadMedia({
    path,
    body: input.bytes,
    contentType: inspected.mimeType,
  });
  const [row] = await db
    .insert(mediaAsset)
    .values({
      storagePath: path,
      fileName: cleaned,
      mimeType: inspected.mimeType,
      sizeBytes: input.sizeBytes ?? null,
      width: inspected.width,
      height: inspected.height,
      alt: input.alt ?? null,
      uploadedByAdminId: input.uploadedByAdminId ?? null,
    })
    .returning();
  if (!row) throw new Error("Media record could not be persisted.");
  return row;
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
