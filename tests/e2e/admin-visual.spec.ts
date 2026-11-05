import { createHmac } from "node:crypto";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { isTestDatabaseUrl } from "../helpers/test-database";
import { supabaseConfigured } from "./global-setup";

const demo =
  process.env.DEMO_AUTH_ENABLED === "true" &&
  process.env.NODE_ENV !== "production";
test.skip(
  !isTestDatabaseUrl(process.env.TEST_DATABASE_URL) ||
    (!demo && !supabaseConfigured()),
  "Administration visual checks require isolated local test data and authentication.",
);
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });

test.beforeEach(async ({ context, baseURL }) => {
  if (!demo) return;
  const payload = `admin.${Date.now() + 3_600_000}`;
  const signature = createHmac(
    "sha256",
    "namaste-local-demo-cookie-signing-secret-v2",
  )
    .update(payload)
    .digest("hex");
  await context.addCookies([
    {
      name: "namaste_demo_admin",
      value: `${payload}.${signature}`,
      url: baseURL!,
      httpOnly: true,
      sameSite: "Strict",
    },
  ]);
});

test("every navigation section fits desktop, tablet and phone without a breadcrumb bar", async ({
  page,
}, testInfo) => {
  test.setTimeout(900_000);
  await page.goto("/admin", { timeout: 180_000 });
  const routes = await page
    .locator('nav[aria-label="Administrace"] a[href^="/admin"]')
    .evaluateAll((links) => [
      ...new Set(links.map((link) => link.getAttribute("href")!)),
    ]);
  expect(routes).toHaveLength(25);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of routes) {
      const response = await page.goto(route, { timeout: 180_000 });
      expect(response?.ok(), `${route} response at ${width}px`).toBe(true);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(
        page.getByText("Administrace se nepodařila načíst"),
      ).toHaveCount(0);
      await expect(
        page.getByText("Data se nepodařilo načíst", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("navigation", { name: /breadcrumb/i }),
      ).toHaveCount(0);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      );
      expect(overflow, `${route} overflow at ${width}px`).toBeLessThanOrEqual(
        1,
      );
      if (
        [
          "/admin",
          "/admin/memberships",
          "/admin/schedule",
          "/admin/reservations",
          "/admin/settings",
        ].includes(route)
      ) {
        await page.screenshot({
          path: testInfo.outputPath(
            `${route.replaceAll("/", "-")}-${width}.png`,
          ),
          fullPage: true,
        });
      }
    }
  }
  expect(errors).toEqual([]);
});

test("BoardUI adapters preserve native submit, explicit buttons, disabled states and links", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin/design-system", { timeout: 180_000 });
  const form = page.getByRole("form", { name: "Ukázkový formulář BoardUI" });
  await form.getByLabel("Ukázková cena (Kč)").fill("279");
  await form.getByRole("button", { name: "Potvrdit ukázku" }).click();
  await expect(form.getByRole("status")).toHaveText(
    "Ukázka potvrzena: 279 Kč.",
  );
  await form.getByRole("button", { name: "Obnovit ukázku" }).click();
  await expect(form.getByRole("status")).toHaveText("Ukázka obnovena.");
  await expect(form.getByLabel("Ukázková cena (Kč)")).toHaveValue("229");
  await expect(
    form.getByRole("button", { name: "Probíhá ukládání" }),
  ).toBeDisabled();
  const submit = form.getByRole("button", { name: "Potvrdit ukázku" });
  expect(
    await submit.evaluate((element) => getComputedStyle(element).fontWeight),
  ).toBe("500");
  expect(
    await submit.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).toBe("rgb(0, 69, 52)");
  await page.locator('a.admin-button[href="/admin/schedule"]').first().click();
  await expect(page).toHaveURL(/\/admin\/schedule$/);
  await expect(
    page.getByLabel("Otevřeno", { exact: true }).first(),
  ).toBeVisible();
});
