import { test, expect } from "@playwright/test";

async function dismissTrackingConsentIfShown(
  page: import("@playwright/test").Page,
) {
  const button = page
    .getByTestId("tracking-consent")
    .getByRole("button", { name: "Pouze nezbytné" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

test.describe("Public site", () => {
  test("operating rules render as nine navigable sections", async ({
    page,
  }) => {
    await page.goto("/provozni-rad", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { level: 1, name: "Provozní řád" }),
    ).toBeVisible();
    await expect(
      page.getByText("Tento provozní řád je platný a účinný od: 1. září 2026"),
    ).toBeVisible();
    await expect(page.locator("article > section")).toHaveCount(9);
    await expect(page.locator("article h2")).toHaveCount(9);
    await expect(page.locator("article li")).toHaveCount(36);
    await expect(
      page.getByRole("navigation", { name: "Obsah provozního řádu" }),
    ).toBeVisible();

    const target = page.locator("#bod-9");
    await page.getByRole("link", { name: /09 Závěrečná ustanovení/ }).click();
    await expect(target).toBeInViewport();
  });

  test("operating rules preserve editorial hierarchy and reflow", async ({
    page,
  }) => {
    for (const width of [320, 390, 667, 768, 1024, 1280, 1440, 1728]) {
      await page.setViewportSize({
        width,
        height: width === 667 ? 375 : width < 700 ? 760 : 900,
      });
      await page.goto("/provozni-rad", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { level: 1, name: "Provozní řád" }),
      ).toBeVisible();

      const layout = await page.evaluate(() => {
        const sectionHeading = document.querySelector("article h2");
        const clause = document.querySelector("article p");
        const contentsLinks = Array.from(
          document.querySelectorAll<HTMLElement>(
            'nav[aria-label="Obsah provozního řádu"] a',
          ),
        );
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          headingSize: sectionHeading
            ? Number.parseFloat(getComputedStyle(sectionHeading).fontSize)
            : 0,
          clauseSize: clause
            ? Number.parseFloat(getComputedStyle(clause).fontSize)
            : 0,
          contentsTargetsAreLargeEnough: contentsLinks.every(
            (link) => link.getBoundingClientRect().height >= 44,
          ),
        };
      });

      expect(
        layout.overflow,
        `horizontal overflow at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(layout.headingSize).toBeGreaterThan(layout.clauseSize);
      expect(layout.contentsTargetsAreLargeEnough).toBe(true);
    }

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/provozni-rad", { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Přeskočit na obsah" }),
    ).toBeFocused();

    let reachedLastSectionLink = false;
    for (let index = 0; index < 24; index += 1) {
      await page.keyboard.press("Tab");
      reachedLastSectionLink = await page.evaluate(
        () => document.activeElement?.getAttribute("href") === "#bod-9",
      );
      if (reachedLastSectionLink) break;
    }
    expect(reachedLastSectionLink).toBe(true);
    const outlineStyle = await page.evaluate(
      () => getComputedStyle(document.activeElement!).outlineStyle,
    );
    expect(outlineStyle).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#bod-9$/);
  });

  test("terms render as 21 navigable sections", async ({ page }) => {
    await page.goto("/obchodni-podminky", {
      waitUntil: "domcontentloaded",
    });
    await dismissTrackingConsentIfShown(page);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "VŠEOBECNÉ OBCHODNÍ PODMÍNKY",
      }),
    ).toBeVisible();
    await expect(page.getByText("Účinnost od 17. 8. 2026")).toBeVisible();
    await expect(page.locator("article > section")).toHaveCount(21);
    await expect(page.locator("article h2")).toHaveCount(21);
    await expect(
      page.getByRole("navigation", {
        name: "Obsah všeobecných obchodních podmínek",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "České obchodní inspekce" }),
    ).toHaveAttribute("href", "https://coi.gov.cz/informace-o-adr/");

    const target = page.locator("#clanek-21");
    await page.getByRole("link", { name: /21\. ZÁVĚREČNÁ USTANOVENÍ/ }).click();
    await expect(target).toBeInViewport();
  });

  test("terms preserve hierarchy and reflow", async ({ page }) => {
    for (const width of [320, 768, 1280]) {
      await page.setViewportSize({
        width,
        height: width < 700 ? 760 : 900,
      });
      await page.goto("/obchodni-podminky", {
        waitUntil: "domcontentloaded",
      });
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "VŠEOBECNÉ OBCHODNÍ PODMÍNKY",
        }),
      ).toBeVisible();
      await dismissTrackingConsentIfShown(page);

      const layout = await page.evaluate(() => {
        const sectionHeading = document.querySelector("article h2");
        const clause = document.querySelector("article p");
        const contentsLinks = Array.from(
          document.querySelectorAll<HTMLElement>(
            'nav[aria-label="Obsah všeobecných obchodních podmínek"] a',
          ),
        );
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          headingSize: sectionHeading
            ? Number.parseFloat(getComputedStyle(sectionHeading).fontSize)
            : 0,
          clauseSize: clause
            ? Number.parseFloat(getComputedStyle(clause).fontSize)
            : 0,
          contentsTargetsAreLargeEnough: contentsLinks.every(
            (link) => link.getBoundingClientRect().height >= 44,
          ),
        };
      });

      expect(
        layout.overflow,
        `horizontal overflow at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(layout.headingSize).toBeGreaterThan(layout.clauseSize);
      expect(layout.contentsTargetsAreLargeEnough).toBe(true);
    }
  });

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
      page.getByRole("link", { name: "Rezervovat", exact: true }).first(),
    ).toBeVisible();
    // The gallery now shows photographs of the actual gym.
    await expect(page.locator("[data-illustrative-photo-marker]")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Ilustrační foto" }),
    ).toHaveCount(0);
    // Two icon links now: the PNG the metadata declares and the classic
    // /favicon.ico that browsers and link-preview tools request unprompted.
    await expect(
      page.locator('link[rel~="icon"][type="image/png"]'),
    ).toHaveAttribute("href", /icon\.png/);
    await expect(
      page.locator('link[rel~="icon"][href^="/favicon.ico"]'),
    ).toHaveCount(1);
    const operatingSteps = page.locator("#jak-to-funguje");
    for (const number of ["01", "02", "03", "04", "05", "06"]) {
      await expect(
        operatingSteps.getByText(number, { exact: true }),
      ).toBeVisible();
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const desktopNavigation = page.getByTestId("desktop-navigation");
    await expect(desktopNavigation).toBeVisible();
    const navigationLayout = await desktopNavigation.evaluate((navigation) => {
      const links = Array.from(navigation.querySelectorAll("a"));
      const first = links[0]?.getBoundingClientRect();
      const last = links.at(-1)?.getBoundingClientRect();
      const navigationBox = navigation.getBoundingClientRect();
      return {
        width: Math.round(navigationBox.width),
        occupiedWidth:
          first && last ? Math.round(last.right - first.left) : undefined,
        allCaps: links.every(
          (link) => getComputedStyle(link).textTransform === "uppercase",
        ),
      };
    });
    expect(navigationLayout.allCaps).toBe(true);
    expect(navigationLayout.width).toBeGreaterThanOrEqual(530);
    expect(navigationLayout.occupiedWidth).toBeGreaterThanOrEqual(510);
    const stepAlignment = await operatingSteps
      .locator("li")
      .evaluateAll((cards) =>
        cards.map((card) => ({
          numberLeft: Math.round(
            card.querySelector("span")!.getBoundingClientRect().left,
          ),
          headingAlign: getComputedStyle(card.querySelector("h3")!).textAlign,
          bodyAlign: getComputedStyle(card.querySelector("p")!).textAlign,
        })),
      );
    expect(stepAlignment).toHaveLength(6);
    expect(
      new Set(stepAlignment.map(({ numberLeft }) => numberLeft)).size,
    ).toBe(3);
    expect(stepAlignment[0]!.numberLeft).toBe(stepAlignment[3]!.numberLeft);
    expect(stepAlignment[1]!.numberLeft).toBe(stepAlignment[4]!.numberLeft);
    expect(stepAlignment[2]!.numberLeft).toBe(stepAlignment[5]!.numberLeft);
    expect(
      stepAlignment.every(
        ({ headingAlign, bodyAlign }) =>
          headingAlign === "left" && bodyAlign === "left",
      ),
    ).toBe(true);
    const contact = page.getByTestId("location-card");
    await expect(contact.getByText("Otevírací doba")).toHaveCount(1);
    await expect(contact.getByText(/Křížkova 424\/23/i)).toBeVisible();
    await expect(contact.getByText("info@namastegym.cz")).toHaveCount(0);
    await expect(contact.getByText("777 666 555")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "+420 731 737 355", exact: true }),
    ).toHaveAttribute("href", "tel:+420731737355");
    await expect(
      page.getByRole("link", { name: "+420 721 560 150", exact: true }),
    ).toHaveAttribute("href", "tel:+420721560150");
    await expect(
      page.getByRole("contentinfo").getByText("301 00", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /WhatsApp, NAVI Private Gym/i }),
    ).toHaveAttribute("href", "https://wa.me/420732817217");
    await expect(
      page.getByRole("link", { name: /Facebook, NAVI Private Gym/i }),
    ).toHaveAttribute(
      "href",
      "https://www.facebook.com/profile.php?id=61594273731288",
    );
    await expect(
      page.getByRole("link", { name: /Instagram, NAVI Private Gym/i }),
    ).toHaveAttribute("href", "https://www.instagram.com/navi_plzen/");
    // `q` is what makes Google draw its own marker, so it stays on the address
    // when the visitor zooms or pans.
    await expect(page.getByTestId("location-map")).toHaveAttribute(
      "src",
      /maps\?q=49\.7550669,13\.3785039&ll=49\.7550669,13\.3785039&z=17&output=embed$/,
    );
    const closingCta = page.locator("#pridej-se");
    const [closingHeading, closingButton] = await Promise.all([
      closingCta.getByRole("heading").boundingBox(),
      closingCta.getByRole("link", { name: /Rezervovat/i }).boundingBox(),
    ]);
    expect(closingHeading).not.toBeNull();
    expect(closingButton).not.toBeNull();
    const closingHeadingLineCount = await closingCta
      .getByRole("heading")
      .evaluate((heading) => {
        const range = document.createRange();
        range.selectNodeContents(heading);
        return range.getClientRects().length;
      });
    expect(closingHeadingLineCount).toBe(1);
    const spaceHeading = await page.locator("#prostor h2").boundingBox();
    expect(spaceHeading).not.toBeNull();
    const closingGap =
      closingButton!.x - (closingHeading!.x + closingHeading!.width);
    expect(Math.abs(closingHeading!.x - spaceHeading!.x)).toBeLessThanOrEqual(
      1,
    );
    expect(closingGap).toBeGreaterThanOrEqual(40);
    const closingContainer = await closingCta
      .locator(":scope > div")
      .boundingBox();
    expect(closingContainer).not.toBeNull();
    const closingPaddingRight = await closingCta
      .locator(":scope > div")
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingRight),
      );
    expect(
      Math.abs(
        closingButton!.x +
          closingButton!.width -
          (closingContainer!.x + closingContainer!.width - closingPaddingRight),
      ),
    ).toBeLessThanOrEqual(1);
    const heroAvailability = page.locator(
      'section[aria-labelledby="hero-availability-title"]',
    );
    await expect(heroAvailability.getByText(/\/ 75 minut/i)).toHaveCount(0);
    await expect(heroAvailability.getByText(/každý 10\. vstup/i)).toHaveCount(
      0,
    );
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

  test("real equipment photos load without illustrative labels", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/vybaveni", { waitUntil: "domcontentloaded" });

    // The page hero plus all six equipment-zone photographs.
    const photos = page.locator("main img");
    await expect(photos).toHaveCount(7);
    const mobileRatios = await page
      .locator("li[data-zone] img")
      .evaluateAll((images) =>
        images.map((image) => {
          const box = image.parentElement!.getBoundingClientRect();
          return box.height / box.width;
        }),
      );
    expect(mobileRatios).toHaveLength(6);
    expect(mobileRatios[0]).toBeGreaterThan(0.8);
    expect(mobileRatios[0]).toBeLessThan(0.9);
    expect(mobileRatios.slice(1).every((ratio) => ratio >= 1.25)).toBe(true);
    const stretchZoom = await page
      .locator("li[data-zone]")
      .nth(2)
      .locator("img")
      .evaluate((image) => Number.parseFloat(getComputedStyle(image).scale));
    expect(stretchZoom).toBeGreaterThan(1.5);
    await expect(page.locator("li[data-zone]").nth(3).locator("h3")).toHaveText(
      "Zázemí pro vás",
    );
    await expect(page.locator("li[data-zone]").last().locator("h3")).toHaveText(
      "Zázemí pro děti",
    );
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded();
      await expect
        .poll(async () =>
          photo.evaluate(
            (image) =>
              image instanceof HTMLImageElement &&
              image.complete &&
              image.naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
    await expect(page.locator("[data-illustrative-photo-marker]")).toHaveCount(
      0,
    );

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator("[data-illustrative-photo-marker]")).toHaveCount(
      0,
    );

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("gallery arranges four gym details in a grid on mobile and desktop", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });

    const galleryPhotos = page.locator("#prostor img");
    await expect(galleryPhotos).toHaveCount(5);
    await expect(
      page.locator('#prostor img[alt="Vybavená lednice"]'),
    ).toBeVisible();
    const mobileTiles = await galleryPhotos.evaluateAll((images) =>
      images.slice(1).map((image) => {
        const box = image.parentElement!.getBoundingClientRect();
        return {
          alt: image.getAttribute("alt"),
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      }),
    );
    expect(mobileTiles.map((tile) => tile.alt)).toEqual([
      "Detail tréninkové zóny",
      "Zázemí a vstup",
      "Vybavená lednice",
      "Další pohled na prostor",
    ]);
    expect(mobileTiles[0]!.y).toBeCloseTo(mobileTiles[1]!.y, 0);
    expect(mobileTiles[2]!.y).toBeCloseTo(mobileTiles[3]!.y, 0);
    expect(mobileTiles[0]!.x).toBeCloseTo(mobileTiles[2]!.x, 0);
    expect(mobileTiles[1]!.x).toBeCloseTo(mobileTiles[3]!.x, 0);
    expect(mobileTiles.every((tile) => tile.height >= tile.width)).toBe(true);

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(
      page.locator('#prostor img[alt="Vybavená lednice"]'),
    ).toBeVisible();
    await expect(galleryPhotos).toHaveCount(5);
    const desktopTiles = await galleryPhotos.evaluateAll((images) =>
      images.slice(1).map((image) => {
        const box = image.parentElement!.getBoundingClientRect();
        return {
          alt: image.getAttribute("alt"),
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
        };
      }),
    );
    expect(desktopTiles.map((tile) => tile.alt)).toEqual([
      "Detail tréninkové zóny",
      "Zázemí a vstup",
      "Vybavená lednice",
      "Další pohled na prostor",
    ]);
    expect(desktopTiles[0]!.y).toBeCloseTo(desktopTiles[1]!.y, 0);
    expect(desktopTiles[2]!.y).toBeCloseTo(desktopTiles[3]!.y, 0);
    expect(desktopTiles[0]!.x).toBeCloseTo(desktopTiles[2]!.x, 0);
    expect(desktopTiles[1]!.x).toBeCloseTo(desktopTiles[3]!.x, 0);
    expect(
      desktopTiles.every((tile) => tile.width > 0 && tile.height > 0),
    ).toBe(true);
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
    if (process.env.REQUIRE_DB === "1") await expect(calendar).toBeVisible();
    if (await calendar.isVisible().catch(() => false)) {
      await expect(calendar).toBeVisible();
      // The page opens on today, so nobody has to pick a day before seeing
      // times, and the "choose a day first" prompt never applies.
      await expect(page.getByText(/Nejprve zvolte den/i)).toHaveCount(0);
      await expect(
        page.locator('a[role="gridcell"][aria-selected="true"]'),
      ).toHaveCount(1);
      const available = page.getByRole("gridcell", {
        name: /dostupné termíny/i,
      });
      if ((await available.count()) > 0) {
        await available.first().click();
        await expect(
          page.getByText(/\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/).first(),
        ).toBeVisible();
      }
    } else {
      await expect(unavailable).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Zkusit znovu" }),
      ).toBeVisible();
    }
  });

  test("selected slots lead to the details step, consents and all", async ({
    page,
  }) => {
    await page.goto("/rezervace", { waitUntil: "domcontentloaded" });
    await dismissTrackingConsentIfShown(page);
    // A slot is a toggle button whose accessible name ends with "Vybrat".
    const slot = page.getByRole("button", { name: /Vybrat$/ });
    const slotCount = await slot.count();
    if (process.env.REQUIRE_DB === "1")
      expect(slotCount).toBeGreaterThanOrEqual(2);
    else
      test.skip(slotCount < 2, "Not enough bookable slots in this environment");
    await slot.first().click();
    await expect(
      page.getByRole("button", { pressed: true }).first(),
    ).toHaveAccessibleName(/Vybráno$/);
    // A second slot joins the same order; the bar counts both.
    await slot.first().click();
    const bar = page.getByRole("region", { name: "Vybrané termíny" });
    await expect(bar).toContainText("Vybráno: 2 termíny");
    await expect(page).toHaveURL(/start=.*start=/);

    await bar.getByRole("link", { name: /Pokračovat/ }).click();
    // No detour through the login page: booking works without an account.
    await expect(page).toHaveURL(/\/rezervace\/udaje\?start=/);
    await expect(page.getByTestId("chosen-slot")).toHaveCount(2);
    for (const label of [/Jméno/, /Příjmení/, /E-mail/, /Telefon/]) {
      await expect(page.getByLabel(label).first()).toBeVisible();
    }
    // Scoped to the booking form: the analytics consent dialog has its own.
    const consents = page.locator("form").getByRole("checkbox");
    await expect(consents).toHaveCount(1);
    await expect(consents).not.toBeChecked();
    await expect(consents).toHaveAccessibleName(
      "Souhlasím s provozním řádem a obchodními podmínkami.",
    );
    await expect(
      page.getByRole("link", { name: "provozním řádem" }),
    ).toHaveAttribute("href", "/provozni-rad");
    await expect(
      page.getByRole("link", { name: "obchodními podmínkami" }),
    ).toHaveAttribute("href", /obchodni-podminky/);
    await expect(
      page.getByRole("button", { name: /Pokračovat k platbě/i }),
    ).toBeVisible();
  });

  test("available calendar dates support arrow keys and keyboard selection", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto("/rezervace", { waitUntil: "domcontentloaded" });
    const available = page.locator(
      'a[role="gridcell"][aria-label*="dostupné termíny"]',
    );
    const availableCount = await available.count();

    if (process.env.REQUIRE_DB === "1")
      expect(availableCount).toBeGreaterThanOrEqual(2);
    else
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
    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/, {
      timeout: 30_000,
    });
    await expect(
      page.getByText(/\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/).first(),
    ).toBeVisible();
  });

  test("the first date selection on a fresh calendar always commits", async ({
    browser,
  }) => {
    // Regression: under a `loading.tsx` boundary the React canary bundled in
    // Next 15.5 could drop the ping of a Flight row that arrived while it was
    // unwinding, leaving the transition parked until a second interaction.
    // Fresh pages per attempt reproduce the first-interaction race; the guard
    // below skips the check where live availability is not configured.
    test.setTimeout(90_000);
    const probe = await browser.newPage();
    await probe.goto("/rezervace", { waitUntil: "domcontentloaded" });
    const availableCount = await probe
      .locator('a[role="gridcell"][aria-label*="dostupné termíny"]')
      .count();
    await probe.close();
    if (process.env.REQUIRE_DB === "1")
      expect(availableCount).toBeGreaterThanOrEqual(2);
    else
      test.skip(
        availableCount < 2,
        "Live availability is not configured in this environment",
      );

    for (const attempt of [1, 2, 3, 4]) {
      const page = await browser.newPage();
      await page.goto("/rezervace", { waitUntil: "networkidle" });
      const entry = page.locator('a[role="gridcell"][tabindex="0"]');
      await entry.focus();
      await entry.press("ArrowRight");
      const target = page.locator('[role="gridcell"]:focus');
      const targetDate = await target.getAttribute("data-date");
      expect(targetDate, `attempt ${attempt} moved focus`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      if (attempt % 2 === 1) await target.press("Enter");
      else await target.click();
      await expect(page, `attempt ${attempt} committed`).toHaveURL(
        new RegExp(`date=${targetDate}`),
        { timeout: 8_000 },
      );
      await page.close();
    }
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
    const mobileStepLayout = await page
      .locator("#jak-to-funguje li")
      .evaluateAll((steps) =>
        steps.map((step) => ({
          numberLeft: Math.round(
            step.querySelector("span")!.getBoundingClientRect().left,
          ),
          bodyAlign: getComputedStyle(step.querySelector("p")!).textAlign,
        })),
      );
    expect(
      new Set(mobileStepLayout.map(({ numberLeft }) => numberLeft)).size,
    ).toBe(1);
    expect(
      mobileStepLayout.every(({ bodyAlign }) => bodyAlign === "left"),
    ).toBe(true);
    const footerBrandLayout = await page
      .locator("footer > div > div")
      .first()
      .evaluate((brandBlock) => {
        const block = brandBlock.getBoundingClientRect();
        // The brand renders as a masked span, not an <img>.
        const logo = brandBlock
          .querySelector('[data-brand="lockup"]')!
          .getBoundingClientRect();
        const copy = brandBlock.querySelector("p")!;
        return {
          blockCenter: Math.round(block.left + block.width / 2),
          logoCenter: Math.round(logo.left + logo.width / 2),
          copyAlign: getComputedStyle(copy).textAlign,
        };
      });
    expect(
      Math.abs(footerBrandLayout.blockCenter - footerBrandLayout.logoCenter),
    ).toBeLessThanOrEqual(1);
    expect(footerBrandLayout.copyAlign).toBe("center");
    const [footerMenu, footerContact, footerInformation, footerSocials] =
      await Promise.all([
        page
          .getByRole("contentinfo")
          .getByRole("heading", { name: "Menu" })
          .boundingBox(),
        page
          .getByRole("contentinfo")
          .getByRole("heading", { name: "Kontakt" })
          .boundingBox(),
        page
          .getByRole("contentinfo")
          .getByRole("heading", { name: "Informace" })
          .boundingBox(),
        page
          .getByRole("contentinfo")
          .getByRole("heading", { name: "Sledujte nás" })
          .boundingBox(),
      ]);
    expect(footerMenu).not.toBeNull();
    expect(footerContact).not.toBeNull();
    expect(footerInformation).not.toBeNull();
    expect(footerSocials).not.toBeNull();
    expect(Math.abs(footerMenu!.y - footerContact!.y)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(footerInformation!.y - footerSocials!.y),
    ).toBeLessThanOrEqual(1);
    expect(footerSocials!.x).toBeGreaterThan(footerInformation!.x);
    const [mobileCta, mobileCtaContainer] = await Promise.all([
      page
        .locator("#pridej-se")
        .getByRole("link", { name: /Rezervovat/i })
        .boundingBox(),
      page.locator("#pridej-se > div").boundingBox(),
    ]);
    expect(mobileCta).not.toBeNull();
    expect(mobileCtaContainer).not.toBeNull();
    const mobileCtaPaddingRight = await page
      .locator("#pridej-se > div")
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingRight),
      );
    /*
     * The client asked for this action to be centred on mobile; from `lg` it
     * returns to the right edge. Compare centres inside the container's
     * content box.
     */
    const mobileCtaPaddingLeft = await page
      .locator("#pridej-se > div")
      .evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).paddingLeft),
      );
    const contentLeft = mobileCtaContainer!.x + mobileCtaPaddingLeft;
    const contentRight =
      mobileCtaContainer!.x + mobileCtaContainer!.width - mobileCtaPaddingRight;
    expect(
      Math.abs(
        mobileCta!.x + mobileCta!.width / 2 - (contentLeft + contentRight) / 2,
      ),
    ).toBeLessThanOrEqual(1);
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
    await expect(page.locator("details")).toHaveCount(21);
    const firstFaqItem = page
      .locator("details")
      .filter({ hasText: "Jak se k nám dostanete?" });
    const firstFaqMark = firstFaqItem.locator(
      "summary > span > span[aria-hidden='true']",
    );
    await expect(firstFaqMark).toHaveCSS("mask-image", /navi-mark\.png/);
    await firstFaqItem.locator("summary").click();
    await expect
      .poll(() =>
        firstFaqMark.evaluate((mark) => getComputedStyle(mark).opacity),
      )
      .toBe("0");
    await expect(page.getByText(/zastávka Rondel/i)).toBeVisible();
    await page.goto("/vybaveni");
    await expect(
      page.getByRole("heading", { name: /Vybavení a prostor/i }),
    ).toBeVisible();
    await page.goto("/login");
    await expect(page.getByLabel(/E-mail/i)).toBeVisible();
    await expect(page.getByLabel(/Heslo/i)).toBeVisible();
    const googleConfigured = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
      .split(",")
      .includes("google");
    await expect(
      page.getByRole("link", { name: "Pokračovat přes Google" }),
    ).toHaveCount(googleConfigured ? 1 : 0);
    if (googleConfigured)
      await expect(
        page.getByRole("link", { name: "Pokračovat přes Google" }),
      ).toHaveAttribute("href", /\/auth\/signin\?provider=google/);
    await page.setViewportSize({ width: 390, height: 844 });
    const backLink = page.getByRole("link", { name: /NAVI Private Gym/i });
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
    /*
     * Seven full page loads, each waiting on the externally hosted hero
     * photograph. That lands within a second of the default limit, so the run
     * would otherwise pass or fail on noise.
     */
    test.setTimeout(90_000);

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

  test("privacy page publishes the GDPR information", async ({ page }) => {
    await page.goto("/ochrana-soukromi", {
      waitUntil: "domcontentloaded",
    });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Zásady ochrany osobních údajů",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Dokument čeká na schválení provozovatelem"),
    ).toHaveCount(0);
    await expect(
      page.getByText("Klára Bílková", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Renáta Janoušková", { exact: true }),
    ).toBeVisible();
    /*
     * The policy quotes whatever ids this build actually loads, so the
     * assertion follows the build's environment instead of a fixed pair that
     * would keep passing after the account behind it was retired.
     */
    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
    const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
    await expect(
      page.getByText(gaId || "Google tag zatím nemáme nastavený"),
    ).toBeVisible();
    await expect(
      page.getByText(pixelId || "Pixel zatím nemáme nastavený"),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/ochrana-soukromi$/,
    );
  });

  test("reduced motion disables non-essential transitions", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const duration = await page
      .getByRole("link", { name: "Rezervovat", exact: true })
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    const durationSeconds = duration.endsWith("ms")
      ? Number.parseFloat(duration) / 1000
      : Number.parseFloat(duration);
    expect(durationSeconds).toBeLessThanOrEqual(0.00001);
  });
});
