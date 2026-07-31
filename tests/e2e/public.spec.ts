import { test, expect } from "@playwright/test";

test.describe("Public site", () => {
  test("homepage communicates the offer, price, location and booking action", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { level: 1, name: /Tvůj čas/i }),
    ).toBeVisible();
    await expect(page.getByText(/Kč/).first()).toBeVisible();
    await expect(page.getByText(/Křížkova 424\/23/).first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Vybrat termín/i }).first(),
    ).toBeVisible();
    await expect(page.locator('link[rel~="icon"]')).toHaveAttribute(
      "href",
      /icon\.png/,
    );
    const operatingSteps = page.locator("#jak-to-funguje");
    for (const number of ["01", "02", "03", "04", "05", "06"]) {
      await expect(
        operatingSteps.getByText(number, { exact: true }),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const stepAlignment = await operatingSteps
      .locator("li")
      .evaluateAll((cards) =>
        cards.map((card) => ({
          headingTop: Math.round(
            card.querySelector("h3")!.getBoundingClientRect().top,
          ),
          bodyTop: Math.round(
            card.querySelector("p")!.getBoundingClientRect().top,
          ),
        })),
      );
    for (const rowStart of [0, 3]) {
      expect(
        new Set(
          stepAlignment
            .slice(rowStart, rowStart + 3)
            .map(({ headingTop }) => headingTop),
        ).size,
      ).toBe(1);
      expect(
        new Set(
          stepAlignment
            .slice(rowStart, rowStart + 3)
            .map(({ bodyTop }) => bodyTop),
        ).size,
      ).toBe(1);
    }
    const contact = page.locator("#kontakt");
    await expect(contact.getByText("Otevírací doba")).toHaveCount(0);
    await expect(
      contact.getByRole("link", { name: /Křížkova 424\/23/i }),
    ).toBeVisible();
    await expect(
      contact.getByRole("link", { name: "info@namastegym.cz" }),
    ).toBeVisible();
    await expect(
      contact.getByRole("link", { name: "777 666 555" }),
    ).toBeVisible();
    await expect(page.getByTestId("location-map")).toHaveAttribute(
      "src",
      /maps\?ll=49\.7550669,13\.3785039&z=17&output=embed$/,
    );
    const closingCta = page.locator("#pridej-se");
    const [closingHeading, closingButton] = await Promise.all([
      closingCta.getByRole("heading").boundingBox(),
      closingCta.getByRole("link", { name: /Rezervovat/i }).boundingBox(),
    ]);
    expect(closingHeading).not.toBeNull();
    expect(closingButton).not.toBeNull();
    const closingGap =
      closingButton!.x - (closingHeading!.x + closingHeading!.width);
    expect(closingGap).toBeGreaterThanOrEqual(79);
    expect(closingGap).toBeLessThanOrEqual(81);
    const closingGroupCenter =
      (closingHeading!.x + closingButton!.x + closingButton!.width) / 2;
    expect(Math.abs(closingGroupCenter - 640)).toBeLessThanOrEqual(1);
    const pricingCard = page.getByTestId("pricing-card");
    await expect(
      pricingCard.getByText("Jednorázový vstup", { exact: true }),
    ).toHaveCount(1);
    await expect(
      pricingCard.getByText("Celý gym jen pro vás", { exact: true }),
    ).toHaveCount(0);
    await expect(
      pricingCard.getByText(/Každý 10\. vstup zdarma pro registrované/i),
    ).toHaveCount(0);
    await expect(
      pricingCard.getByText(/Bez registračních poplatků a bez závazku/i),
    ).toHaveCount(0);
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
      await expect(
        page.getByRole("button", { name: "Zkusit znovu" }),
      ).toBeVisible();
    }
  });

  test("available calendar dates support arrow keys and keyboard selection", async ({
    page,
  }) => {
    await page.goto("/rezervace", { waitUntil: "domcontentloaded" });
    const available = page.locator(
      'a[role="gridcell"][aria-label*="dostupné termíny"]',
    );
    const availableCount = await available.count();

    test.skip(
      availableCount < 2,
      "Live availability is not configured in this environment",
    );

    const calendarEntry = page.locator('a[role="gridcell"][tabindex="0"]');
    await expect(calendarEntry).toHaveCount(1);
    await expect(calendarEntry).toBeVisible();
    await calendarEntry.focus();
    await expect(calendarEntry).toBeFocused();
    await calendarEntry.press("ArrowRight");
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
      page.locator("#mobile-menu").getByRole("link", { name: "FAQ" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /Otevřít menu/i }),
    ).toBeFocused();
    await expect(
      page.getByRole("button", { name: /Otevřít menu/i }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  test("FAQ, equipment and login routes remain usable", async ({ page }) => {
    await page.goto("/faq", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Často kladené otázky" }),
    ).toBeVisible();
    await expect(page.locator("details")).toHaveCount(20);
    const firstFaqItem = page
      .locator("details")
      .filter({ hasText: "Jak se k nám dostanete?" });
    const firstFaqMark = firstFaqItem.locator("summary [aria-hidden='true']");
    await expect(firstFaqMark).toHaveCSS("mask-image", /namaste-lotus\.png/);
    await firstFaqItem.locator("summary").click();
    await expect
      .poll(() =>
        firstFaqMark.evaluate((mark) => getComputedStyle(mark).rotate),
      )
      .toBe("90deg");
    await expect(page.getByText(/zastávka Rondel/i)).toBeVisible();
    await page.goto("/vybaveni");
    await expect(
      page.getByRole("heading", { name: /Vybavení a prostor/i }),
    ).toBeVisible();
    await page.goto("/login");
    await expect(page.getByLabel(/E-mail/i)).toBeVisible();
    await expect(page.getByLabel(/Heslo/i)).toBeVisible();
    await expect(page.getByText(/Pokračovat přes/i)).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    const backLink = page.getByRole("link", { name: /NAMASTÉ Private Gym/i });
    await expect(backLink).toBeVisible();
    const backLinkBox = await backLink.boundingBox();
    expect(backLinkBox?.height).toBeGreaterThanOrEqual(44);
  });

  test("skip link is the first keyboard destination", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Přeskočit na obsah" });
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#main-content")).toHaveCount(1);
    await skip.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
    await page.keyboard.press("Tab");
    const headerContainsFocus = await page
      .locator("header")
      .evaluate((header) => header.contains(document.activeElement));
    expect(headerContainsFocus).toBe(false);
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

  test("public footers finish at the document bottom", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const route of [
      "/",
      "/faq",
      "/vybaveni",
      "/provozni-rad",
      "/obchodni-podminky",
      "/ochrana-soukromi",
      "/rezervace",
    ]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(
        page.locator("footer"),
        `missing footer on ${route}`,
      ).toBeVisible();
      const geometry = await page.evaluate(() => {
        const footer = document.querySelector("footer");
        if (!(footer instanceof HTMLElement)) return null;
        return {
          documentBottom: document.documentElement.scrollHeight,
          footerBottom: Math.round(
            footer.getBoundingClientRect().bottom + window.scrollY,
          ),
        };
      });
      expect(geometry, `missing footer on ${route}`).not.toBeNull();
      expect(
        Math.abs(geometry!.documentBottom - geometry!.footerBottom),
        `footer gap on ${route}`,
      ).toBeLessThanOrEqual(1);
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
    const durationSeconds = duration.endsWith("ms")
      ? Number.parseFloat(duration) / 1000
      : Number.parseFloat(duration);
    expect(durationSeconds).toBeLessThanOrEqual(0.00001);
  });
});
