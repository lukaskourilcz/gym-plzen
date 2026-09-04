import { expect, test } from "@playwright/test";

/**
 * The switch is internal tooling and lives on `/dev` alone. Nothing a visitor
 * can do : any page, any width, before or after someone has used the preview :
 * puts the control in front of them.
 */
test.describe("Design preview gate", () => {
  test("the switch exists on no public page, at any width", async ({
    page,
  }) => {
    for (const width of [390, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/", "/vybaveni", "/faq"]) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("design-variant-switch")).toHaveCount(0);
        await expect(page.getByRole("radio", { name: "Moderní" })).toHaveCount(
          0,
        );
      }
    }

    // Including inside the mobile menu, which is where it used to sit.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Otevřít menu/i }).click();
    await expect(page.getByTestId("design-variant-switch")).toHaveCount(0);

    // And the site still renders in the approved look.
    await expect(page.locator("html")).toHaveAttribute(
      "data-design",
      "classic",
    );
  });

  test("/dev carries the switch and the choice follows across the site", async ({
    page,
  }) => {
    await page.goto("/dev", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: "Náhled vzhledu" }),
    ).toBeVisible();

    const chooser = page.getByTestId("design-variant-switch");
    await expect(chooser).toHaveCount(1);
    await chooser.getByText("Moderní", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-design", "modern");

    // The look carries, but the control does not come with it.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-design", "modern");
    await expect(page.getByTestId("design-variant-switch")).toHaveCount(0);

    // Choosing the approved look again is the way back.
    await page.goto("/dev", { waitUntil: "domcontentloaded" });
    await page
      .getByTestId("design-variant-switch")
      .getByText("Klasický", { exact: true })
      .click();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute(
      "data-design",
      "classic",
    );
  });

  test("the preview page is not indexable", async ({ page }) => {
    await page.goto("/dev", { waitUntil: "domcontentloaded" });
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
