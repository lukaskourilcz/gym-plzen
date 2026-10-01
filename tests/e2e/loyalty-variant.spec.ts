import { expect, test } from "@playwright/test";

/**
 * The loyalty widget is the reference case for a variant difference that is a
 * genuinely different shape rather than a token change: both presentations ship
 * in the DOM and CSS reveals one.
 *
 * Runs against the local demo mode, whose customer has
 * six entries, so the ring must read 6/10.
 */
test.describe("Loyalty progress across variants", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login?next=%2Faccount");
    await page.getByLabel("E-mail").fill("klient@namaste.demo");
    await page.getByLabel("Heslo").fill("namaste2026");
    await page
      .getByRole("button", { name: "Přihlásit se", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account$/);
  });

  test("classic shows the approved segment bar and hides the ring", async ({
    page,
  }) => {
    await expect(page.locator("html")).toHaveAttribute(
      "data-design",
      "classic",
    );
    await expect(page.locator('[data-loyalty="segments"]')).toBeVisible();
    await expect(page.locator('[data-loyalty="ring"]')).toBeHidden();
  });

  test("modern shows the gold ring at the same progress", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: "ns_design", value: "modern", url: baseURL! },
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.locator("html")).toHaveAttribute("data-design", "modern");
    const ring = page.locator('[data-loyalty="ring"]');
    await expect(ring).toBeVisible();
    await expect(page.locator('[data-loyalty="segments"]')).toBeHidden();

    // The demo customer has six of ten entries; both presentations read that
    // from the same rule, so this is exactly what the bar would have filled.
    await expect(ring).toContainText("6/10");

    // Decorative in both variants: the sentence above states the real status.
    await expect(ring).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByText("Do vstupu zdarma")).toBeVisible();
  });
});
