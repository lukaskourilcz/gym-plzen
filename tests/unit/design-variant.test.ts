import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DESIGN_VARIANT,
  DESIGN_VARIANT_INIT_SCRIPT,
  parseDesignVariant,
  readDesignVariantFromCookies,
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

test("the inline script only ever stamps a known variant", () => {
  // It runs before hydration, so a stray value must never reach `data-design`.
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /\(classic\|modern\)/);
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /dataset\.design/);
  assert.match(DESIGN_VARIANT_INIT_SCRIPT, /catch/);
});

test("the switch is not shipped to any page but /dev", async () => {
  // The control is internal tooling: the guarantee is structural, not a CSS
  // rule that a specificity change could quietly defeat.
  const fs = await import("node:fs/promises");
  const header = await fs.readFile(
    "src/components/site/site-header.tsx",
    "utf8",
  );
  assert.ok(
    !header.includes("DesignVariantSwitch"),
    "the site header must not render the design switch",
  );

  const usages = await fs.readFile("src/app/dev/variant-picker.tsx", "utf8");
  assert.ok(usages.includes("DesignVariantSwitch"), "/dev keeps the switch");
});
