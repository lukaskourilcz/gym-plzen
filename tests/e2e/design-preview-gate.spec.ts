import { expect, test } from "@playwright/test";

/**
 * The switch is internal tooling. A visitor who never types /dev must not meet
 * it anywhere: not visually, not by keyboard, not through a screen reader.
 */
test.describe("Design preview gate", () => {
  test("an ordinary visitor never sees or reaches the switch", async ({
    page,
  }) => {
    for (const path of ["/", "/vybaveni", "/faq"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });

      await expect(page.locator("html")).not.toHaveAttribute(
        "data-preview",
        "on",
      );
      // `display: none` removes it from the accessibility tree as well as the
      // page, so a role query finds nothing to announce or focus.
      await expect(page.getByRole("radio", { name: "Moderní" })).toHaveCount(0);
      await expect(
        page.getByTestId("design-variant-switch").first(),
      ).toBeHidden();
    }

    // And the site still renders in the approved look.
    await expect(page.locator("html")).toHaveAttribute(
      "data-design",
      "classic",
    );
  });

  test("opening /dev unlocks the switch across the site", async ({ page }) => {
    await page.goto("/dev", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: "Náhled vzhledu" }),
    ).toBeVisible();
    await expect(page.getByText("Náhled je zapnutý")).toBeVisible();

    // Arriving is the whole gesture: the cookie is set without any click.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "ns_preview")?.value).toBe("on");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-preview", "on");
    await expect(
      page.getByTestId("design-variant-switch").first(),
    ).toBeVisible();

    // The unlocked switch still drives the variant.
    await page
      .getByTestId("design-variant-switch")
      .first()
      .getByText("Moderní", { exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-design", "modern");
  });

  test("turning the preview off hides the switch again", async ({ page }) => {
    await page.goto("/dev", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Náhled je zapnutý")).toBeVisible();

    await page.getByRole("button", { name: "Vypnout náhled" }).click();
    await expect(page.getByText("Náhled je vypnutý")).toBeVisible();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-preview",
      "on",
    );
    await expect(
      page.getByTestId("design-variant-switch").first(),
    ).toBeHidden();
  });

  test("the preview page is not indexable", async ({ page }) => {
    await page.goto("/dev", { waitUntil: "domcontentloaded" });
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });
});
