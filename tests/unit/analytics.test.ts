import assert from "node:assert/strict";
import test from "node:test";
import { parseConsentPreferences } from "../../src/lib/config/analytics";
import { createGoogleTag } from "../../src/lib/analytics/google-tag";

test("Google commands use the Arguments protocol rather than ignored arrays", () => {
  const queue: IArguments[] = [];
  const gtag = createGoogleTag((command) => queue.push(command));
  gtag("config", "test-id", { send_page_view: true });
  assert.ok(queue[0]);
  assert.equal(Object.prototype.toString.call(queue[0]), "[object Arguments]");
  assert.equal(Array.isArray(queue[0]), false);
  assert.deepEqual(Array.from(queue[0]), [
    "config",
    "test-id",
    { send_page_view: true },
  ]);
});

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

test("the privacy policy names the ids that actually load", async () => {
  const fs = await import("node:fs/promises");
  const policy = await fs.readFile("src/app/ochrana-soukromi/page.tsx", "utf8");

  /*
   * The policy is a legal statement about what the browser really loads, so it
   * has to read the same ids as the trackers. A hardcoded id silently outlives
   * the account it named: the rebrand moved measurement to the environment,
   * but this page kept quoting the retired Namasté GA4 and Meta ids.
   */
  assert.doesNotMatch(policy, /G-[A-Z0-9]{6,}/);
  assert.doesNotMatch(policy, /\d{15,}/);
  assert.match(policy, /\{GOOGLE_ANALYTICS_ID\}/);
  assert.match(policy, /\{META_PIXEL_ID\}/);
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
