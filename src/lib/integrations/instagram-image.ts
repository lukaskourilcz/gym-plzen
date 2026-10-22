import sharp from "sharp";
import { env } from "@/lib/env";
import { isInstagramImageUrl } from "@/lib/config/instagram";
import { InstagramError, readLimitedBody } from "./instagram";
/** A bounded image decoder, no third-party iframe/script or full video download. */
export async function readInstagramImage(source: string) {
  if (!isInstagramImageUrl(source)) throw new InstagramError("image");
  let target = new URL(source);
  if (env.INSTAGRAM_TEST_BASE_URL) {
    const mock = new URL(env.INSTAGRAM_TEST_BASE_URL);
    if (
      !(
        process.env.NODE_ENV === "test" || process.env.E2E_LOCAL_AUTH === "true"
      ) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(mock.hostname)
    )
      throw new InstagramError("not_configured");
    target = new URL("/image", mock);
    target.searchParams.set("source", source);
  }
  try {
    const response = await fetch(target, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (
      !response.ok ||
      !/^image\/(jpeg|png|webp|avif)(;|$)/i.test(
        response.headers.get("content-type") ?? "",
      )
    )
      throw new InstagramError("image");
    const bytes = await readLimitedBody(response, 6_000_000, "image");
    const data = await sharp(bytes, {
      limitInputPixels: 20_000_000,
      animated: false,
    })
      .rotate()
      .resize(480, 480, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    return data.toString("base64");
  } catch {
    throw new InstagramError("image");
  }
}
