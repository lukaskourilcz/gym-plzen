import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DESIGN_VARIANT,
  DESIGN_VARIANT_INIT_SCRIPT,
  parseDesignVariant,
  readDesignPreviewFromCookies,
  readDesignVariantFromCookies,
  serialiseDesignPreviewCookie,
  serialiseDesignVariantCookie,
} from "../../src/lib/config/design-variant";

test("an unknown or missing variant falls back to the approved classic look", () => {
  assert.equal(DEFAULT_DESIGN_VARIANT, "classic");
  assert.equal(parseDesignVariant("modern"), "modern");
  assert.equal(parseDesignVariant("classic"), "classic");
  assert.equal(parseDesignVariant("brutalist"), "classic");
  assert.equal(parseDesignVariant(null), "classic");
  assert.equal(parseDesignVariant(undefined), "classic");
});

test("the variant is read out of a raw cookie string", () => {
  assert.equal(readDesignVariantFromCookies("ns_design=modern"), "modern");
  assert.equal(
    readDesignVariantFromCookies("foo=1; ns_design=modern; bar=2"),
    "modern",
  );
  // A cookie whose name merely ends in the same characters must not match.
  assert.equal(
    readDesignVariantFromCookies("other_ns_design=modern"),
    "classic",
  );
  assert.equal(readDesignVariantFromCookies("ns_design=nonsense"), "classic");
  assert.equal(readDesignVariantFromCookies(""), "classic");
  assert.equal(readDesignVariantFromCookies(null), "classic");
});

test("the cookie is scoped site-wide and only Secure over https", () => {
  const secure = serialiseDesignVariantCookie("modern", true);
  assert.match(
    secure,
    /^ns_design=modern; path=\/; max-age=31536000; samesite=lax; secure$/,
  );
  assert.equal(
    serialiseDesignVariantCookie("classic", false),
    "ns_design=classic; path=/; max-age=31536000; samesite=lax",
  );
});

test("the switch stays locked until this browser has opened /dev", () => {
  assert.equal(readDesignPreviewFromCookies("ns_preview=on"), true);
  assert.equal(readDesignPreviewFromCookies("a=1; ns_preview=on; b=2"), true);
  // Anything short of the exact unlock value leaves the control hidden.
  assert.equal(readDesignPreviewFromCookies("ns_preview=off"), false);
  assert.equal(readDesignPreviewFromCookies("ns_preview=ON"), false);
  assert.equal(readDesignPreviewFromCookies("other_ns_preview=on"), false);
  assert.equal(readDesignPreviewFromCookies(""), false);
  assert.equal(readDesignPreviewFromCookies(null), false);
});

test("turning the preview off expires its cookie", () => {
  assert.match(
    serialiseDesignPreviewCookie(true, true),
    /^ns_preview=on; path=\/; max-age=31536000; samesite=lax; secure$/,
  );
  assert.equal(
    serialiseDesignPreviewCookie(false, false),
    "ns_preview=; path=/; max-age=0; samesite=lax",
  );
});

test("the inline script only ever stamps a known variant", () => {
  // It runs before hydration, so a stray value must never reach `data-design`.
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /\(classic\|modern\)/);
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /dataset\.design/);
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /catch/);
  // It also decides the switch's visibility before paint, so the control never
  // flashes into view for an ordinary visitor.
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /dataset\.preview/);
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /ns_preview=on/);
});
