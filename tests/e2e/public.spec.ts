import { test, expect } from "@playwright/test";

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
    await page
      .getByTestId("tracking-consent")
      .getByRole("button", { name: "Pouze nezbytné" })
      .click();

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
    ).toHaveAttribute(
      "href",
      "https://coi.gov.cz/informace-o-adr/?utm_source=chatgpt.com",
    );

    const target = page.locator("#clanek-21");
    await page.getByRole("link", { name: /21\. ZÁVĚREČNÁ USTANOVENÍ/ }).click();
    await expect(target).toBeInViewport();
  });

  test("terms preserve hierarchy and reflow", async ({ page }) => {
    let consentHandled = false;
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
      if (!consentHandled) {
        await page
          .getByTestId("tracking-consent")
          .getByRole("button", { name: "Pouze nezbytné" })
          .click();
        consentHandled = true;
      }

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
      page.getByRole("link", { name: /WhatsApp, NAMASTÉ Private Gym/i }),
    ).toHaveAttribute("href", "https://wa.me/420731737355");
    await expect(
      page.getByRole("link", { name: /Facebook, NAMASTÉ Private Gym/i }),
    ).toHaveAttribute(
      "href",
      "https://www.facebook.com/profile.php?id=61592125101750",
    );
    await expect(
      page.getByRole("link", { name: /Instagram, NAMASTÉ Private Gym/i }),
    ).toHaveAttribute("href", "https://www.instagram.com/namaste_plzen/");
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

  test("a slot leads straight to the details step, consents and all", async ({
    page,
  }) => {
    await page.goto("/rezervace", { waitUntil: "domcontentloaded" });
    const slot = page.getByRole("link", { name: /pokračovat k rezervaci/i });
    test.skip(
      (await slot.count()) === 0,
      "No bookable slot in this environment",
    );

    await slot.first().click();
    // No detour through the login page: booking works without an account.
    await expect(page).toHaveURL(/\/rezervace\/udaje\?start=/);
    await expect(page.getByTestId("chosen-slot")).toBeVisible();
    for (const label of [/Jméno/, /Příjmení/, /E-mail/, /Telefon/]) {
      await expect(page.getByLabel(label).first()).toBeVisible();
    }
    const consents = page.getByRole("checkbox");
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
      page.getByText(/\d{1,2}:\d{2}\s*–\s*\d{1,2}:\d{2}/).first(),
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
        const logo = brandBlock.querySelector("img")!.getBoundingClientRect();
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
    expect(
      Math.abs(
        mobileCta!.x +
          mobileCta!.width -
          (mobileCtaContainer!.x +
            mobileCtaContainer!.width -
            mobileCtaPaddingRight),
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
    await expect(page.locator("details")).toHaveCount(20);
    const firstFaqItem = page
      .locator("details")
      .filter({ hasText: "Jak se k nám dostanete?" });
    const firstFaqMark = firstFaqItem.locator(
      "summary > span > span[aria-hidden='true']",
    );
    await expect(firstFaqMark).toHaveCSS("mask-image", /namaste-lotus\.png/);
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
    await expect(page.getByText("G-6L9N41NKT8")).toBeVisible();
    await expect(page.getByText("1816423579552231")).toBeVisible();
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
