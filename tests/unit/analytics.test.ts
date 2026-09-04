import assert from "node:assert/strict";
import test from "node:test";
import { parseConsentPreferences } from "../../src/lib/config/analytics";

test("tracking preferences require both explicit boolean categories", () => {
  assert.deepEqual(
    parseConsentPreferences('{"analytics":true,"marketing":false}'),
    { analytics: true, marketing: false },
  );
  assert.equal(parseConsentPreferences("granted"), null);
  assert.equal(parseConsentPreferences('{"analytics":true}'), null);
  assert.equal(parseConsentPreferences("not-json"), null);
});

test("a tracker with no configured id is disabled rather than half-started", async () => {
  const {
    GOOGLE_ANALYTICS_ID,
    META_PIXEL_ID,
    isAnalyticsConfigured,
    isMarketingConfigured,
  } = await import("../../src/lib/config/analytics");

  // This test process sets neither id, which is the "no account yet" state.
  assert.equal(GOOGLE_ANALYTICS_ID, null);
  assert.equal(META_PIXEL_ID, null);
  assert.equal(isAnalyticsConfigured, false);
  assert.equal(isMarketingConfigured, false);
});

test("no measurement id is baked into the source", async () => {
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/lib/config/analytics.ts", "utf8");
  // Real GA4 and Meta ids must live in the environment, not the repository.
  assert.doesNotMatch(source, /"G-[A-Z0-9]{6,}"/);
  assert.doesNotMatch(source, /"\d{15,}"/);
});

test("with no trackers configured there is no consent to ask for", async () => {
  const fs = await import("node:fs/promises");
  const consent = await fs.readFile(
    "src/components/site/analytics-consent.tsx",
    "utf8",
  );
  const button = await fs.readFile(
    "src/components/site/cookie-settings-button.tsx",
    "utf8",
  );
  // Asking permission to run trackers that do not exist would be misleading,
  // so both the bar and its footer link stand down.
  assert.match(
    consent,
    /if \(!isAnalyticsConfigured && !isMarketingConfigured\)/,
  );
  assert.match(
    button,
    /if \(!isAnalyticsConfigured && !isMarketingConfigured\)/,
  );
});

test("every public env key is also read statically", async () => {
  // Next.js only inlines `process.env.NEXT_PUBLIC_*` when it is written out
  // literally, so a key declared in the schema but missing from the parse call
  // is silently always undefined in the browser.
  const fs = await import("node:fs/promises");
  const source = await fs.readFile("src/lib/public-env.ts", "utf8");
  const declared = [...source.matchAll(/^\s{2}(NEXT_PUBLIC_\w+):/gm)].map(
    (m) => m[1],
  );
  assert.ok(declared.length > 5);
  for (const key of declared) {
    assert.ok(
      source.includes(`process.env.${key}`),
      `${key} is declared but never read from process.env`,
    );
  }
});
