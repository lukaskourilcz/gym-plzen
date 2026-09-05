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

test("demo credentials open the admin dashboard without Supabase", async ({
  page,
}) => {
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

  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.ok(), `${route} returned ${response?.status()}`).toBe(
      true,
    );
    await expect(page).toHaveURL(
      new RegExp(`${route.replaceAll("/", "\\/")}$`),
    );
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(
      page.getByText("Administrace se nepodařila načíst"),
    ).toHaveCount(0);
  }

  expect(pageErrors).toEqual([]);
});
