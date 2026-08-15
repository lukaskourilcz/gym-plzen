import { expect, test } from "@playwright/test";

const STORAGE_KEY = "namaste:analytics-consent-v1";
const GOOGLE_TAG_SELECTOR =
  'script[src="https://www.googletagmanager.com/gtag/js?id=G-6L9N41NKT8"]';

test.describe("Google Analytics consent", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (key) => window.localStorage.removeItem(key),
      STORAGE_KEY,
    );
  });

  test("does not load Google Analytics before consent", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("analytics-consent")).toBeVisible();
    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(0);
    const mobileLayout = await page
      .getByTestId("analytics-consent")
      .evaluate((banner) => ({
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        insideViewport:
          banner.getBoundingClientRect().left >= 0 &&
          banner.getBoundingClientRect().right <= window.innerWidth,
        buttonsAreLargeEnough: Array.from(
          banner.querySelectorAll("button"),
        ).every((button) => button.getBoundingClientRect().height >= 44),
      }));
    expect(mobileLayout.overflow).toBeLessThanOrEqual(1);
    expect(mobileLayout.insideViewport).toBe(true);
    expect(mobileLayout.buttonsAreLargeEnough).toBe(true);

    await page.getByRole("button", { name: "Pouze nezbytné" }).click();
    await expect(page.getByTestId("analytics-consent")).toHaveCount(0);
    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
      )
      .toBe("denied");
  });

  test("loads GA4 after consent and lets visitors reopen settings", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Povolit analytiku" }).click();

    await expect(page.locator(GOOGLE_TAG_SELECTOR)).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY),
      )
      .toBe("granted");

    const queuedCommands = await page.evaluate(() =>
      (window.dataLayer ?? []).map((entry) =>
        Array.from(entry as ArrayLike<unknown>),
      ),
    );
    expect(queuedCommands).toContainEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
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
    expect(
      queuedCommands.some(
        (command) => command[0] === "config" && command[1] === "G-6L9N41NKT8",
      ),
    ).toBe(true);

    await page.getByRole("button", { name: "Nastavení cookies" }).click();
    await expect(page.getByTestId("analytics-consent")).toBeVisible();
  });
});
