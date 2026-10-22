import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { INSTAGRAM_CACHE_TAG } from "@/lib/config/instagram";
import { instagramImageSource } from "@/lib/services/instagram";
import { readInstagramImage } from "@/lib/integrations/instagram-image";
const cachedImage = unstable_cache(
  readInstagramImage,
  ["instagram-thumbnail-v1"],
  { revalidate: 1800, tags: [INSTAGRAM_CACHE_TAG] },
);
export const maxDuration = 30;
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Permission/visibility is checked on every request, before consulting the image cache.
    const source = await instagramImageSource((await params).id);
    if (!source)
      return new NextResponse(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const data = Buffer.from(await cachedImage(source), "base64");
    return new NextResponse(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
