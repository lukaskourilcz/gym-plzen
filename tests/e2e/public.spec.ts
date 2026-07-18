import { test, expect } from "@playwright/test";

/** Public marketing site + booking flow (unauthenticated). */
test.describe("Public site", () => {
  test("homepage renders hero, price and CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // A price with the Kč currency appears (exact amount is admin-editable).
    await expect(page.getByText(/Kč/).first()).toBeVisible();
    // Primary CTA to booking.
    await expect(page.getByRole("link", { name: /Rezervovat/i }).first()).toBeVisible();
  });

  test("navigation to booking works and shows hourly slots", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Rezervovat/i }).first().click();
    await expect(page).toHaveURL(/\/rezervace/);
    await expect(page.getByRole("heading", { name: /Vyberte si termín/i })).toBeVisible();
    // Hourly slots present (e.g. a top-of-hour label).
    await expect(page.getByText(/1[0-9]:00|0?[5-9]:00/).first()).toBeVisible();
  });

  test("unauthenticated slot click routes to login", async ({ page }) => {
    await page.goto("/rezervace?d=1"); // tomorrow → future slots only
    const slot = page.getByRole("link", { name: /\d{1,2}:00 – \d{1,2}:00/ }).first();
    await slot.click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /Přihlášení/i })).toBeVisible();
  });

  test("login page renders shadcn form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/E-mail/i)).toBeVisible();
    await expect(page.getByLabel(/Heslo/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Přihlásit se/i })).toBeVisible();
  });
});
