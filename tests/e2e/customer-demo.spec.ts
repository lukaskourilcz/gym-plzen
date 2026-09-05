import { expect, test } from "@playwright/test";

test("demo customer credentials open the customer account without Supabase", async ({
  page,
}) => {
  await page.goto("/login?next=%2Faccount");
  await page.getByLabel("E-mail").fill("klient@namaste.demo");
  await page.getByLabel("Heslo").fill("namaste2026");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("heading", { name: "Dobrý den, Klára" }),
  ).toBeVisible();
  await expect(page.getByText("Věrnostní program")).toBeVisible();
  await expect(page.getByText("Nadcházející rezervace")).toBeVisible();
  await expect(
    page
      // The range dash is flanked by non-breaking spaces, so match them loosely.
      .getByText(/\d{1,2}\. \d{1,2}\. \d{4} · \d{1,2}:00\s*–\s*\d{1,2}:\d{2}/)
      .first(),
  ).toBeVisible();

  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
    const layout = await page.evaluate(() => {
      const controls = Array.from(
        document.querySelectorAll<HTMLElement>("main a, main button"),
      ).filter((control) => {
        const rect = control.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      return {
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        controlsStayInsideViewport: controls.every((control) => {
          const rect = control.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= window.innerWidth + 1;
        }),
      };
    });
    expect(
      layout.overflow,
      `account has page overflow at ${width}px`,
    ).toBeLessThanOrEqual(1);
    expect(layout.controlsStayInsideViewport).toBe(true);
    await expect(
      page.getByRole("heading", { name: "Dobrý den, Klára" }),
    ).toBeVisible();
  }
});
