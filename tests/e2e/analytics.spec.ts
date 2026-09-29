import { expect, test } from "@playwright/test";

/*
 * Measurement ids are inlined at build time. This suite exercises the
 * configured path, so build with the same values (see tests/e2e/README).
 * The unconfigured path, where nothing loads and no consent is requested, is
 * covered by tests/unit/analytics.test.ts.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-E2ETEST000";
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "1000000000000000";

/*
 * Where the saved choice really lives. The rebrand renamed this key, and a
 * suite still clearing and asserting the old one neither starts from a clean
 * slate nor sees what the page just saved. Both retired keys are cleared too,
 * so a stale value cannot suppress the banner.
 */
const STORAGE_KEY = "navi:tracking-consent-v2";
const LEGACY_TRACKING_STORAGE_KEY = "namaste:tracking-consent-v2";
const LEGACY_STORAGE_KEY = "namaste:analytics-consent-v1";
const GOOGLE_TAG_SELECTOR = `script[src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"]`;
const META_TAG_SELECTOR =
  'script[src="https://connect.facebook.net/en_US/fbevents.js"]';

test.describe("tracking consent", () => {
  test.beforeEach(async ({ page }) => {
    // The test observes injected tags and queued consent commands. Never
    // contact a real analytics or advertising endpoint from the local run.
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.addInitScript(
      ({ current, legacyTracking, legacy }) => {
        window.localStorage.removeItem(current);
        window.localStorage.removeItem(legacyTracking);
        window.localStorage.removeItem(legacy);
      },
      {
        current: STORAGE_KEY,
        legacyTracking: LEGACY_TRACKING_STORAGE_KEY,
        legacy: LEGACY_STORAGE_KEY,
      },
    );
  });

  test("does not load optional tracking before consent", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const banner = page.getByTestId("tracking-consent");
    await expect(banner).toBeVisible();
    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(0);
    await expect(page.locator(META_TAG_SELECTOR)).toHaveCount(0);
    await expect(
      banner.getByRole("checkbox", { name: /Analytika/ }),
    ).not.toBeChecked();
    await expect(
      banner.getByRole("checkbox", { name: /Marketing/ }),
    ).not.toBeChecked();

    const mobileLayout = await banner.evaluate((element) => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      insideViewport:
        element.getBoundingClientRect().left >= 0 &&
        element.getBoundingClientRect().right <= window.innerWidth,
      controlsAreLargeEnough: Array.from(
        element.querySelectorAll("button, label"),
      ).every((control) => control.getBoundingClientRect().height >= 44),
    }));
    expect(mobileLayout.overflow).toBeLessThanOrEqual(1);
    expect(mobileLayout.insideViewport).toBe(true);
    expect(mobileLayout.controlsAreLargeEnough).toBe(true);

    await banner.getByRole("button", { name: "Pouze nezbytné" }).click();
    await expect(banner).toHaveCount(0);
    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(0);
    await expect(page.locator(META_TAG_SELECTOR)).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
      )
      .toBe(JSON.stringify({ analytics: false, marketing: false }));
  });

  test("keeps analytics and marketing as independent choices", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const banner = page.getByTestId("tracking-consent");
    await banner.getByRole("checkbox", { name: /Analytika/ }).check();
    await banner.getByRole("button", { name: "Uložit volbu" }).click();

    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(1);
    await expect(page.locator(META_TAG_SELECTOR)).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
      )
      .toBe(JSON.stringify({ analytics: true, marketing: false }));

    const queuedCommands = await page.evaluate(() =>
      (window.dataLayer ?? []).map((entry) =>
        Array.from(entry as ArrayLike<unknown>),
      ),
    );
    expect(queuedCommands).toContainEqual([
      "consent",
      "update",
      {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
  });

  test("loads Meta Pixel and PageView only after marketing consent", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const banner = page.getByTestId("tracking-consent");
    await banner.getByRole("checkbox", { name: /Marketing/ }).check();
    await banner.getByRole("button", { name: "Uložit volbu" }).click();

    await expect(page.locator(META_TAG_SELECTOR)).toHaveCount(1);
    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(0);
    const metaQueue = await page.evaluate(() => window.fbq?.queue ?? []);
    expect(metaQueue).toContainEqual(["init", PIXEL_ID]);
    expect(metaQueue).toContainEqual(["track", "PageView"]);

    await page.getByRole("button", { name: "Nastavení cookies" }).click();
    await expect(page.getByTestId("tracking-consent")).toBeVisible();
  });

  test("asks again when migrating the former analytics-only choice", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ current, legacyTracking, legacy }) => {
        localStorage.removeItem(current);
        localStorage.removeItem(legacyTracking);
        localStorage.setItem(legacy, "granted");
      },
      {
        current: STORAGE_KEY,
        legacyTracking: LEGACY_TRACKING_STORAGE_KEY,
        legacy: LEGACY_STORAGE_KEY,
      },
    );
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const banner = page.getByTestId("tracking-consent");
    await expect(banner).toBeVisible();
    await expect(
      banner.getByRole("checkbox", { name: /Analytika/ }),
    ).toBeChecked();
    await expect(
      banner.getByRole("checkbox", { name: /Marketing/ }),
    ).not.toBeChecked();
    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(0);
    await expect(page.locator(META_TAG_SELECTOR)).toHaveCount(0);
  });
});
