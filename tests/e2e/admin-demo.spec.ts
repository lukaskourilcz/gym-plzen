import { expect, test } from "@playwright/test";

test("demo credentials open the admin dashboard without Supabase", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fadmin");
  await page.getByLabel("E-mail").fill("admin@namaste.demo");
  await page.getByLabel("Heslo").fill("namaste2026");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Přehled" })).toBeVisible();
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
