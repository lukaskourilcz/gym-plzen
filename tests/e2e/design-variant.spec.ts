import { test, expect } from "@playwright/test";

/**
 * The Klasický/Moderní switch is a preview mechanism: a cookie plus a
 * `data-design` attribute stamped before first paint. These tests pin the two
 * things that would silently break it: persistence across reload/navigation,
 * and the CSS actually reacting to the attribute.
 */
test.describe("Design variant switch", () => {
  test("defaults to classic, switches, and survives reload and navigation", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-design", "classic");

    const spacing = () =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--section-space-lg")
          .trim(),
      );
    const classicSpacing = await spacing();

    await page
      .getByTestId("design-variant-switch")
      .first()
      .getByRole("radio", { name: "Moderní" })
      .check();

    await expect(html).toHaveAttribute("data-design", "modern");
    expect(await spacing()).not.toBe(classicSpacing);

    // Persisted in the cookie, so the choice outlives the page instance.
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "ns_design")?.value).toBe("modern");

    // The attribute is applied before paint, so it is already correct on the
    // very first commit after a reload.
    await page.reload({ waitUntil: "commit" });
    await expect(html).toHaveAttribute("data-design", "modern");

    await page.goto("/faq", { waitUntil: "commit" });
    await expect(html).toHaveAttribute("data-design", "modern");

    await page
      .getByTestId("design-variant-switch")
      .first()
      .getByRole("radio", { name: "Klasický" })
      .check();
    await expect(html).toHaveAttribute("data-design", "classic");
  });

  test("is a labelled radio group reachable and operable by keyboard", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const group = page.getByTestId("design-variant-switch").first();
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio")).toHaveCount(2);

    const classic = group.getByRole("radio", { name: "Klasický" });
    await classic.focus();
    // Arrow keys move within a native radio group; that is the whole point of
    // using real radios instead of styled buttons.
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("html")).toHaveAttribute("data-design", "modern");

    const box = await group
      .getByRole("radio", { name: "Moderní" })
      .boundingBox();
    // The visible label carries the target, so measure the control's own row.
    const labelBox = await group
      .getByText("Moderní", { exact: true })
      .boundingBox();
    expect(box || labelBox).toBeTruthy();
    expect(labelBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test("does not appear twice at any width", async ({ page }) => {
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width < 700 ? 760 : 900 });
      await page.goto("/", { waitUntil: "domcontentloaded" });

      const visible = page
        .getByTestId("design-variant-switch")
        .filter({ visible: true });
      // Below `md` it lives in the (closed) mobile menu, above it in the bar.
      const count = await visible.count();
      expect(count, `width ${width}`).toBeLessThanOrEqual(1);

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
        `no horizontal overflow at ${width}`,
      ).toBeLessThanOrEqual(0);
    }
  });
});
