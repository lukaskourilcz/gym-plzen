import { z } from "zod";
import { getContentAsset } from "@/lib/content/editor-visuals";
export const contentAssetSchema = z
  .object({
    key: z.string().max(100),
    value: z.string().trim().min(1, "Vyplňte hodnotu.").max(2048),
  })
  .superRefine((input, ctx) => {
    const asset = getContentAsset(input.key);
    if (!asset) {
      ctx.addIssue({
        code: "custom",
        path: ["key"],
        message: "Tento obrázek nelze upravit.",
      });
      return;
    }
    if (asset.kind === "text") {
      if (input.value.length > 180)
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "Použijte nejvýše 180 znaků.",
        });
      return;
    }
    let https = false;
    try {
      const url = new URL(input.value);
      https =
        url.protocol === "https:" &&
        !url.username &&
        !url.password &&
        (url.hostname === "static.wixstatic.com" ||
          (url.hostname.endsWith(".supabase.co") &&
            url.pathname.startsWith("/storage/v1/object/public/")));
    } catch {
      /* Local bundled asset below. */
    }
    if (
      !https &&
      !/^\/images\/[a-z0-9/_-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(
        input.value,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          "Vložte adresu nahraného obrázku ze Supabase, Wixu nebo cestu /images/…",
      });
  });
