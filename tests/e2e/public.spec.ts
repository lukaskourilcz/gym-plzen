import { test, expect } from "@playwright/test";

test.describe("Public site", () => {
  test("homepage communicates the offer, price, location and booking action", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: /Celý gym/i }),
    ).toBeVisible();
    await expect(page.getByText(/Kč/).first()).toBeVisible();
    await expect(page.getByText(/Křížkova 424\/23/).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Vybrat termín/i }).first(),
    ).toBeVisible();
  });

  test("booking uses a monthly date-first calendar or a transparent unavailable state", async ({
    page,
  }) => {
    await page.goto("/rezervace", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: /Vyberte datum a čas/i }),
    ).toBeVisible();
    const calendar = page.getByRole("grid");
    const unavailable = page.getByText(/Termíny teď nelze načíst/i);
    if (await calendar.isVisible().catch(() => false)) {
      await expect(calendar).toBeVisible();
      await expect(page.getByText(/Nejprve zvolte den/i)).toBeVisible();
      const available = page.getByRole("gridcell", {
        name: /dostupné termíny/i,
      });
      if ((await available.count()) > 0) {
        await available.first().click();
        await expect(
          page.getByText(/\d{1,2}:\d{2}–\d{1,2}:\d{2}/).first(),
        ).toBeVisible();
      }
    } else {
      await expect(unavailable).toBeVisible();
    }
  });

  test("available calendar dates support arrow keys and keyboard selection", async ({
    page,
  }) => {
    await page.goto("/rezervace", { waitUntil: "domcontentloaded" });
    const available = page.getByRole("gridcell", { name: /dostupné termíny/i });

    test.skip(
      (await available.count()) < 2,
      "Live availability is not configured in this environment",
    );

    const firstDate = available.first();
    await firstDate.focus();
    await expect(firstDate).toBeFocused();
    await firstDate.press("ArrowRight");
    const focusedDate = page.locator('[role="gridcell"]:focus');
    await expect(focusedDate).toBeFocused();
    await focusedDate.press("Enter");
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
    await expect(
      page.getByText(/\d{1,2}:\d{2}–\d{1,2}:\d{2}/).first(),
    ).toBeVisible();
  });

  test("public layout fits 320px and mobile navigation is operable", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: /Otevřít menu/i }).click();
    await expect(
      page.getByRole("link", { name: "Časté dotazy" }),
    ).toBeVisible();
  });

  test("FAQ, equipment and login routes remain usable", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Časté dotazy" }),
    ).toBeVisible();
    await page.goto("/vybaveni");
    await expect(
      page.getByRole("heading", { name: /Vybavení bez dohadů/i }),
    ).toBeVisible();
    await page.goto("/login");
    await expect(page.getByLabel(/E-mail/i)).toBeVisible();
    await expect(page.getByLabel(/Heslo/i)).toBeVisible();
  });

  test("public routes reflow without horizontal overflow at representative widths", async ({
    page,
  }) => {
    for (const width of [390, 667, 768, 1024, 1280, 1440, 1728]) {
      await page.setViewportSize({ width, height: width < 700 ? 760 : 900 });
      await page.goto(width % 2 === 0 ? "/rezervace" : "/", {
        waitUntil: "domcontentloaded",
      });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
        1,
      );
    }
  });

  test("reduced motion disables non-essential transitions", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const duration = await page
      .getByRole("link", { name: /Vybrat termín/i })
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(duration).toBe("0.01ms");
  });
});
