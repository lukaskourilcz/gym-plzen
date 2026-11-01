import { expect, type Page } from "@playwright/test";

/** Tomorrow may belong to the next displayed week, including across months. */
export async function openCalendarTomorrow(page: Page, dateKey: string) {
  await page.goto("/admin/calendar");
  await expect(
    page.locator(".fc-col-header-cell[data-date]").first(),
  ).toBeVisible();
  const day = page.locator(`.fc-col-header-cell[data-date="${dateKey}"]`);
  if ((await day.count()) === 0)
    await page
      .getByRole("button", { name: "Další období", exact: true })
      .click();
  await expect(day).toBeVisible();
}
