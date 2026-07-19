import { expect, test } from "@playwright/test";

test("demo credentials open the admin dashboard without Supabase", async ({ page }) => {
  await page.goto("/login?next=%2Fadmin");
  await page.getByLabel("E-mail").fill("admin@namaste.demo");
  await page.getByLabel("Heslo").fill("namaste2026");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Přehled" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Rezervace", exact: true })).toBeVisible();
});
