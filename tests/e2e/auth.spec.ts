import { test, expect } from "@playwright/test";
import { supabaseConfigured } from "./global-setup";

/** Authentication flows via the UI (Supabase Auth). */
test.describe("Auth", () => {
  test.skip(
    !supabaseConfigured(),
    "requires a configured Supabase (auth) instance",
  );
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    const consent = page
      .getByTestId("tracking-consent")
      .getByRole("button", { name: "Pouze nezbytné" });
    if (await consent.isVisible()) await consent.click();
  });

  test("member can sign in and reach their account", async ({ page }) => {
    await page.goto("/login?next=/account");
    await page.getByLabel(/E-mail/i).fill("member@example.test");
    await page.getByLabel(/Heslo/i).fill(process.env.E2E_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: /Přihlásit se/i }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(
      page.getByRole("heading", { name: /Dobrý den, Member/i }),
    ).toBeVisible();
    // Loyalty widget renders.
    await expect(page.getByText(/Věrnostní program/i)).toBeVisible();
  });

  test("sign-in form shows a validation error for a bad password", async ({
    page,
  }) => {
    await page.goto("/login");
    // Switch to sign-up so the 8-char rule applies, then submit a short password.
    await page.getByRole("button", { name: /Zaregistrujte se/i }).click();
    await page.getByLabel(/Jméno/i).fill("Test");
    await page.getByLabel(/E-mail/i).fill("bad@example.test");
    await page.getByLabel(/Heslo/i).fill("123");
    await page.getByRole("button", { name: /Zaregistrovat se/i }).click();
    await expect(page.getByText(/alespoň 8 znaků/i)).toBeVisible();
  });

  test("admin sign-in reaches the dashboard", async ({ page }) => {
    await page.goto("/login?next=/admin");
    await page.getByLabel(/E-mail/i).fill("admin@example.test");
    await page.getByLabel(/Heslo/i).fill(process.env.E2E_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: /Přihlásit se/i }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Dnes/i })).toBeVisible();
  });
});
