import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";

const publicRoutes = [
  "/",
  "/faq",
  "/vybaveni",
  "/doprava-a-platba",
  "/provozni-rad",
  "/obchodni-podminky",
  "/ochrana-soukromi",
  "/rezervace",
  "/login",
  "/audit-page-that-does-not-exist",
];
for (const width of [390, 1280]) {
  for (const route of publicRoutes) {
    test(`WCAG public ${route} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map(({ id, impact, nodes }) => ({
          id,
          impact,
          nodes: nodes.map(({ target, failureSummary }) => ({
            target,
            failureSummary,
          })),
        })),
      ).toEqual([]);
    });
  }
}
test.describe("authenticated accessibility", () => {
  for (const [state, routes] of [
    ["member", ["/account"]],
    [
      "admin",
      [
        "/admin",
        "/admin/calendar",
        "/admin/tomorrow",
        "/admin/finance",
        "/admin/reservations",
        "/admin/content",
      ],
    ],
  ] as const) {
    for (const route of routes) {
      test(`WCAG ${route}`, async ({ browser }) => {
        const context = await browser.newContext({
          storageState: join(
            process.cwd(),
            "tests",
            "e2e",
            ".auth",
            `${state}.json`,
          ),
        });
        try {
          const page = await context.newPage();
          await page.goto(
            `http://localhost:${process.env.E2E_PORT ?? "3131"}${route}`,
          );
          const result = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
          expect(
            result.violations.map(({ id, impact, nodes }) => ({
              id,
              impact,
              nodes: nodes.map(({ target, failureSummary }) => ({
                target,
                failureSummary,
              })),
            })),
          ).toEqual([]);
        } finally {
          await context.close();
        }
      });
    }
  }
});

test("checkout details and validation errors remain accessible", async ({
  page,
}) => {
  await page.goto("/rezervace");
  const consent = page.getByRole("button", { name: "Pouze nezbytné" });
  if (await consent.isVisible()) await consent.click();
  await page
    .getByRole("button", { name: /Vybrat$/ })
    .last()
    .click();
  await page
    .getByRole("region", { name: "Vybrané termíny" })
    .getByRole("link", { name: /Pokračovat/ })
    .click();
  await expect(page).toHaveURL(/\/rezervace\/udaje\?start=/);
  await expect(page.getByLabel("E-mail", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/\S/);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  const email = page.getByLabel("E-mail", { exact: true });
  await email.fill("invalid");
  await email.press("Tab");
  expect(
    await email.evaluate(
      (element) => (element as HTMLInputElement).validity.typeMismatch,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test("mobile privacy table can receive keyboard focus and scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/ochrana-soukromi");
  const table = page.locator("#cookies").getByRole("region", {
    name: "Cookies a obdobné technologie",
  });
  await table.focus();
  await expect(table).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => table.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
});

test("pricing copy has a solid contrasting background when its photograph fails", async ({
  page,
}) => {
  await page.route("**/_next/image**", (request) => request.abort());
  await page.goto("/");
  const consent = page.getByRole("button", { name: "Pouze nezbytné" });
  if (await consent.isVisible()) await consent.click();
  const pricing = page.locator("#cenik");
  await pricing.scrollIntoViewIfNeeded();
  expect(
    await pricing.evaluate(
      (element) => getComputedStyle(element.parentElement!).backgroundColor,
    ),
  ).not.toBe("rgba(0, 0, 0, 0)");
  expect(
    (
      await new AxeBuilder({ page })
        .include("#cenik")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
