import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTENT_EDITOR_SECTIONS,
  isEditableContentKey,
} from "../../src/lib/content/editor";
import { CONTENT_VISUALS } from "../../src/lib/content/editor-visuals";
import { SITE_DEFAULTS } from "../../src/lib/content/site";
import { contentAssetSchema } from "../../src/lib/validations/content-asset";

test("every public CMS key has an editor and a visual section", () => {
  const keys = CONTENT_EDITOR_SECTIONS.flatMap((section) => {
    assert.ok(CONTENT_VISUALS[section.title], section.title);
    return section.items.map((item) => item.key);
  });
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(
    Object.keys(SITE_DEFAULTS).filter((key) => !keys.includes(key)),
    [],
  );
  assert.equal(isEditableContentKey("billing.send_documents"), false);
  assert.equal(isEditableContentKey("notifications.operator"), false);
});
test("asset editing only accepts supported image sources and known branding keys", () => {
  for (const value of [
    "/images/photos/hero.webp",
    "https://example.supabase.co/storage/v1/object/public/media/image.webp",
    "https://static.wixstatic.com/media/photo.jpg",
  ])
    assert.equal(
      contentAssetSchema.safeParse({ key: "branding.hero_image_url", value })
        .success,
      true,
    );
  for (const value of [
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "https://example.com/image.jpg",
    "//example.com/image.png",
    "/images/../private.png",
  ])
    assert.equal(
      contentAssetSchema.safeParse({ key: "branding.hero_image_url", value })
        .success,
      false,
    );
  assert.equal(
    contentAssetSchema.safeParse({
      key: "features.additional_people",
      value: "false",
    }).success,
    false,
  );
  assert.equal(
    contentAssetSchema.safeParse({
      key: "branding.hero_image_alt",
      value: "Popis fotografie",
    }).success,
    true,
  );
});
