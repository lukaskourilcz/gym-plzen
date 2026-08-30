import { expect, test } from "@playwright/test";

test("demo customer credentials open the customer account without Supabase", async ({
  page,
}) => {
  await page.goto("/login?next=%2Faccount");
  await page.getByLabel("E-mail").fill("klient@namaste.demo");
  await page.getByLabel("Heslo").fill("namaste2026");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole("heading", { name: "Dobrý den, Klára" }),
  ).toBeVisible();
  await expect(page.getByText("Věrnostní program")).toBeVisible();
  await expect(page.getByText("Nadcházející rezervace")).toBeVisible();
  await expect(
    page
      // The range dash is flanked by non-breaking spaces, so match them loosely.
      .getByText(/\d{1,2}\. \d{1,2}\. \d{4} · \d{1,2}:00\s*–\s*\d{1,2}:\d{2}/)
      .first(),
  ).toBeVisible();
});
