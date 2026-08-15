import { expect, test } from "@playwright/test";

const STORAGE_KEY = "namaste:tracking-consent-v2";
const LEGACY_STORAGE_KEY = "namaste:analytics-consent-v1";
const GOOGLE_TAG_SELECTOR =
  'script[src="https://www.googletagmanager.com/gtag/js?id=G-6L9N41NKT8"]';
const META_TAG_SELECTOR =
  'script[src="https://connect.facebook.net/en_US/fbevents.js"]';

test.describe("tracking consent", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://connect.facebook.net/**", (route) =>
      route.abort(),
    );
    await page.addInitScript(
      ({ current, legacy }) => {
        window.localStorage.removeItem(current);
        window.localStorage.removeItem(legacy);
      },
      { current: STORAGE_KEY, legacy: LEGACY_STORAGE_KEY },
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
    expect(metaQueue).toContainEqual(["init", "1816423579552231"]);
    expect(metaQueue).toContainEqual(["track", "PageView"]);

    await page.getByRole("button", { name: "Nastavení cookies" }).click();
    await expect(page.getByTestId("tracking-consent")).toBeVisible();
  });

  test("asks again when migrating the former analytics-only choice", async ({
    page,
  }) => {
    await page.addInitScript(
      ({ current, legacy }) => {
        localStorage.removeItem(current);
        localStorage.setItem(legacy, "granted");
      },
      { current: STORAGE_KEY, legacy: LEGACY_STORAGE_KEY },
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
