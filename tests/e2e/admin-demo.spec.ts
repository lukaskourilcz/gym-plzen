import { expect, test } from "@playwright/test";

async function loginAsDemoAdmin(page: import("@playwright/test").Page) {
  await page.goto("/login?next=%2Fadmin", {
    waitUntil: "load",
    timeout: 60_000,
  });
  await page.getByLabel("E-mail").fill("admin@namaste.demo");
  await page.getByLabel("Heslo").fill("namaste2026");
  // The fields are server-rendered; wait for React to attach the server-action
  // handler before clicking so a cold dev compilation cannot race the test.
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 180_000 });
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`the ${viewport.name} login stays contextual while admin loads`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(viewport);
    await page.route(/\/admin(?:\?.*)?$/, async (route) => {
      if (
        route.request().method() === "GET" &&
        route.request().headers().rsc === "1"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      await route.continue();
    });

    await page.goto("/login?next=%2Fadmin", {
      waitUntil: "load",
      timeout: 60_000,
    });
    await page.getByLabel("E-mail").fill("admin@namaste.demo");
    await page.getByLabel("Heslo").fill("namaste2026");
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "Přihlásit se", exact: true })
      .click();

    await expect(
      page.getByRole("button", { name: "Přihlašuji…", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Přihlášení" }),
    ).toBeVisible();
    await expect(page.locator('[class*="skeleton-pulse"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin$/, { timeout: 180_000 });
  });
}

test("demo credentials open the admin dashboard without Supabase", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await loginAsDemoAdmin(page);
  // The local preview must not wait for or depend on a database.
  await expect(page.getByRole("heading", { name: "Dnes" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.getByRole("link", { name: "Rezervace", exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const menu = page.getByRole("button", { name: /Menu administrace/i });
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Systém", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await menu.click();
  await page.getByRole("link", { name: "Členové" }).click();
  await expect(page.getByText("Jan Novák").first()).toBeVisible();
});

test("every admin screen renders without a route or error-boundary failure", async ({
  page,
}) => {
  test.setTimeout(900_000);
  await loginAsDemoAdmin(page);

  const routes = [
    "/admin",
    "/admin/calendar",
    "/admin/reservations",
    "/admin/schedule",
    "/admin/entry-log",
    "/admin/members",
    "/admin/memberships",
    "/admin/vouchers",
    "/admin/doklady",
    "/admin/messages",
    "/admin/content",
    "/admin/emails",
    "/admin/newsletter",
    "/admin/settings",
    "/admin/design-system",
    "/admin/statistics",
    "/admin/alerts",
  ];

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1024 });
    for (const route of routes) {
      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
      });
      expect(
        response?.ok(),
        `${route} returned ${response?.status()} at ${width}px`,
      ).toBe(true);
      await expect(page).toHaveURL(
        new RegExp(`${route.replaceAll("/", "\\/")}$`),
      );
      await expect(page.locator("h1").first()).toBeVisible();
      await expect(
        page.getByText("Administrace se nepodařila načíst"),
      ).toHaveCount(0);

      const layout = await page.evaluate(() => {
        const main = document.querySelector("main")?.getBoundingClientRect();
        return {
          overflow: document.documentElement.scrollWidth - window.innerWidth,
          mainLeft: main?.left ?? -1,
          mainRight: main?.right ?? window.innerWidth + 1,
        };
      });
      expect(
        layout.overflow,
        `${route} has page overflow at ${width}px`,
      ).toBeLessThanOrEqual(1);
      expect(
        layout.mainLeft,
        `${route} starts outside ${width}px`,
      ).toBeGreaterThanOrEqual(-1);
      expect(
        layout.mainRight,
        `${route} ends outside ${width}px`,
      ).toBeLessThanOrEqual(width + 1);
    }
  }

  expect(pageErrors).toEqual([]);
});

test("admin calendar uses readable phone and tablet layouts", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await loginAsDemoAdmin(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/calendar", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".fc-timeGridDay-view")).toBeVisible();

  const phoneLayout = await page.evaluate(() => {
    const chunks = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".fc-header-toolbar .fc-toolbar-chunk",
      ),
    ).map((chunk) => chunk.getBoundingClientRect());
    const overlaps = chunks.some((chunk, index) =>
      chunks
        .slice(index + 1)
        .some(
          (other) =>
            chunk.left < other.right &&
            chunk.right > other.left &&
            chunk.top < other.bottom &&
            chunk.bottom > other.top,
        ),
    );
    const buttonHeights = Array.from(
      document.querySelectorAll<HTMLElement>(".fc-button"),
    ).map((button) => button.getBoundingClientRect().height);
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      overlaps,
      minimumButtonHeight: Math.min(...buttonHeights),
    };
  });

  expect(phoneLayout.overflow).toBeLessThanOrEqual(1);
  expect(phoneLayout.overlaps).toBe(false);
  expect(phoneLayout.minimumButtonHeight).toBeGreaterThanOrEqual(44);

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator(".fc-timeGridWeek-view")).toBeVisible();
  const tabletLayout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    minimumButtonHeight: Math.min(
      ...Array.from(document.querySelectorAll<HTMLElement>(".fc-button")).map(
        (button) => button.getBoundingClientRect().height,
      ),
    ),
  }));
  expect(tabletLayout.overflow).toBeLessThanOrEqual(1);
  expect(tabletLayout.minimumButtonHeight).toBeGreaterThanOrEqual(44);
});
