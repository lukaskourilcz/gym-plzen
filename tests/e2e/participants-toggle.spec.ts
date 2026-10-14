import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { createComgateMock } from "../integration/mocks";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
const gateway = createComgateMock(4547, "TOGGLE");
const adminState = join(process.cwd(), "tests/e2e/.auth/admin.json");
const memberState = join(process.cwd(), "tests/e2e/.auth/member.json");
async function enabled(value: boolean) {
  await sql`insert into site_setting (key, value) values ('features.additional_people', ${sql.json(value)}) on conflict (key) do update set value=excluded.value`;
}
test.beforeAll(async () => {
  await gateway.start();
});
test.beforeEach(async () => {
  await enabled(true);
});
test.afterEach(async () => {
  await enabled(true);
});
test.afterAll(async () => {
  await gateway.stop();
  await sql.end({ timeout: 2 });
});

test("admin toggle persists, hides companion controls and counts, and leaves bookings and email unchanged", async ({
  browser,
}) => {
  const admin = await browser.newContext({ storageState: adminState });
  const member = await browser.newContext({ storageState: memberState });
  const guest = await browser.newContext();
  try {
    const page = await admin.newPage();
    const account = await member.newPage();
    const bookingForm = await guest.newPage();
    const [customer] =
      await sql`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
    const today = dateKeyInTimeZone(new Date());
    const fixtureStart = localDateTimeToDate(today, 600);
    const [fixture] =
      await sql`insert into reservation (user_id, starts_at, ends_at, status, price_cents, extra_people, contact_name, contact_email)
      values (${customer!.id}, ${fixtureStart}, ${new Date(fixtureStart.getTime() + 75 * 60_000)}, 'confirmed', 32900, 2, 'Toggle Calendar', 'member@example.test') returning id`;
    const future = localDateTimeToDate(addDaysToDateKey(today, 8), 975);
    const [upcoming] =
      await sql`insert into reservation (user_id, starts_at, ends_at, status, price_cents, extra_people, contact_name, contact_email)
      values (${customer!.id}, ${future}, ${new Date(future.getTime() + 75 * 60_000)}, 'confirmed', 32900, 1, 'Toggle Account', 'member@example.test') returning id`;
    const before = await sql`select * from reservation order by id`;
    const paymentsBefore = await sql`select * from payment order by id`;
    const [emails] = await sql`select count(*)::int as n from email_archive`;
    const [pricingBefore] =
      await sql`select value from site_setting where key='pricing.additional_people'`;
    await page.goto("/admin/calendar");
    await expect(
      page.getByText("Toggle Calendar +2", { exact: true }),
    ).toBeVisible();
    await page.goto("/admin/memberships");
    const toggle = page.getByRole("switch", {
      name: "Doprovod a příplatky",
      exact: true,
    });
    await expect(toggle).toBeChecked();
    // Unsubmitted fee changes must never be persisted by the independent switch.
    await page.getByLabel("Příplatek (Kč)").fill("456");
    await toggle.focus();
    await toggle.press("Space");
    await expect(toggle).not.toBeChecked();
    await expect(toggle).toBeEnabled();
    await page.reload();
    await expect(toggle).not.toBeChecked();
    expect(
      (
        await sql`select value from site_setting where key='pricing.additional_people'`
      )[0]!.value,
    ).toEqual(pricingBefore!.value);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "/tmp/gym-companions-toggle.png",
      fullPage: true,
    });
    const start = localDateTimeToDate(
      addDaysToDateKey(today, 14),
      1125,
    ).toISOString();
    await bookingForm.goto(
      `/rezervace/udaje?start=${encodeURIComponent(start)}`,
    );
    await expect(
      bookingForm.getByRole("radio", { name: /Přijdu/ }),
    ).toHaveCount(0);
    await expect(
      bookingForm.getByText("Kolik lidí přijde?", { exact: true }),
    ).toHaveCount(0);
    await account.goto("/account");
    await expect(
      account.getByRole("link", { name: "Přidat osobu", exact: true }),
    ).toHaveCount(0);
    await account.goto("/account?tab=orders");
    await expect(
      account.getByRole("link", { name: "Přidat osobu", exact: true }),
    ).toHaveCount(0);
    await account.goto(`/account/rezervace/${upcoming!.id}/osoby`);
    await expect(
      account.getByText(/Doprovod je momentálně vypnutý/),
    ).toBeVisible();
    await expect(
      account.getByLabel("Celkový doprovod v rezervaci"),
    ).toHaveCount(0);
    await page.goto("/admin/calendar");
    await expect(
      page.getByText("Toggle Calendar", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Toggle Calendar +2", { exact: true }),
    ).toHaveCount(0);
    await page.goto("/admin/reservations");
    await expect(page.getByLabel("Doprovod", { exact: true })).toHaveCount(0);
    expect(await sql`select * from reservation order by id`).toEqual(before);
    expect(await sql`select * from payment order by id`).toEqual(
      paymentsBefore,
    );
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emails!.n);
    await page.goto("/admin/memberships");
    await toggle.click();
    await expect(toggle).toBeChecked();
    await expect(toggle).toBeEnabled();
    await page.goto("/admin/calendar");
    await expect(
      page.getByText("Toggle Calendar +2", { exact: true }),
    ).toBeVisible();
    await bookingForm.reload();
    await expect(
      bookingForm.getByRole("radio", { name: "Přijdu + 2 osoby", exact: true }),
    ).toBeVisible();
    await account.goto(`/account/rezervace/${upcoming!.id}/osoby`);
    await expect(
      account.getByLabel("Celkový doprovod v rezervaci"),
    ).toBeVisible();
    expect(await sql`select * from reservation order by id`).toEqual(before);
    await sql`delete from reservation where id in (${fixture!.id}, ${upcoming!.id})`;
  } finally {
    await admin.close();
    await member.close();
    await guest.close();
  }
});

test("an old form cannot charge companions after disabling; a refreshed form books at base price", async ({
  page,
}) => {
  const today = dateKeyInTimeZone(new Date());
  const start = localDateTimeToDate(
    addDaysToDateKey(today, 15),
    1125,
  ).toISOString();
  await page.goto(`/rezervace/udaje?start=${encodeURIComponent(start)}`);
  await page.getByLabel("Jméno", { exact: true }).fill("Toggle");
  await page.getByLabel("Příjmení").fill("Booking");
  await page.getByLabel("E-mail").fill("toggle-booking@example.test");
  await page.getByLabel("Telefon", { exact: true }).fill("+420777000111");
  await page.getByRole("checkbox", { name: /Souhlasím s provozním/ }).check();
  await page
    .getByRole("radio", { name: "Přijdu + 2 osoby", exact: true })
    .check();
  const bookings = await sql`select * from reservation order by id`;
  const payments = await sql`select * from payment order by id`;
  await enabled(false);
  await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
  await expect(page.getByText(/Doprovod je momentálně vypnutý/)).toBeVisible();
  expect(await sql`select * from reservation order by id`).toEqual(bookings);
  expect(await sql`select * from payment order by id`).toEqual(payments);
  expect(gateway.creates.length).toBe(0);
  await page.reload();
  await expect(page.getByRole("radio", { name: /Přijdu/ })).toHaveCount(0);
  await page.getByLabel("Jméno", { exact: true }).fill("Toggle");
  await page.getByLabel("Příjmení").fill("Booking");
  await page.getByLabel("E-mail").fill("toggle-booking@example.test");
  await page.getByLabel("Telefon", { exact: true }).fill("+420777000111");
  await page.getByRole("checkbox", { name: /Souhlasím s provozním/ }).check();
  await page.route("https://payments.comgate.cz/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>Lokální platební náhled</h1>",
    });
  });
  await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
  await expect(page).toHaveURL(/payments.comgate.cz/);
  const [booking] =
    await sql`select extra_people, price_cents from reservation where contact_email='toggle-booking@example.test'`;
  const [base] =
    await sql`select value from site_setting where key='pricing.entry_price_cents'`;
  expect(booking!.extra_people).toBe(0);
  expect(booking!.price_cents).toBe(Number(base!.value));
});
