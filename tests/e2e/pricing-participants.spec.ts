import { expect, test } from "@playwright/test";
import { join } from "node:path";
import postgres from "postgres";
import { createComgateMock } from "../integration/mocks";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
const gateway = createComgateMock(4547, "PEOPLE");
test.beforeAll(async () => {
  await gateway.start();
});
test.afterAll(async () => {
  await gateway.stop();
  await sql.end({ timeout: 2 });
});

const adminState = join(process.cwd(), "tests/e2e/.auth/admin.json");
const memberState = join(process.cwd(), "tests/e2e/.auth/member.json");

test.describe("simple pricing administration", () => {
  test.use({ storageState: adminState });
  test("price ranges offer the real first and last block and persist without touching bookings", async ({
    page,
  }) => {
    const before =
      await sql`select id, starts_at, ends_at, status, price_cents, extra_people from reservation order by id`;
    const [emails] = await sql`select count(*)::int as n from email_archive`;
    await page.goto("/admin/memberships");
    await expect(
      page.getByRole("heading", { name: "Ceník a doprovod", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Den", { exact: true }).selectOption("1");
    await page.getByLabel("První blok", { exact: true }).selectOption("300");
    await page.getByLabel("Poslední blok (včetně)").selectOption("600");
    await page.getByLabel("Cena za blok (Kč)").fill("199");
    await page
      .getByRole("button", { name: "Uložit cenu bloků", exact: true })
      .click();
    await expect(
      page.getByText("05:00 až 10:00", { exact: true }),
    ).toBeVisible();
    const [setting] =
      await sql`select value from site_setting where key = 'pricing.time_blocks'`;
    expect(setting!.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dayOfWeek: 1,
          startMinute: 300,
          endMinute: 600,
          priceCents: 19900,
        }),
      ]),
    );
    await page.getByLabel("Příplatek (Kč)").fill("120");
    await page.getByLabel("Jak se příplatek počítá").selectOption("per_person");
    await expect(
      page.getByRole("status").filter({ hasText: "2 osoby navíc: 240" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Uložit příplatek", exact: true })
      .click();
    await expect(page.getByText("Příplatek za doprovod uložen.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Příplatek (Kč)")).toHaveValue("120");
    expect(
      await sql`select id, starts_at, ends_at, status, price_cents, extra_people from reservation order by id`,
    ).toEqual(before);
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emails!.n);
    // Restore this local fixture for the other browser stories.
    await page
      .getByRole("button", { name: "Odebrat", exact: true })
      .first()
      .click();
    await page.getByLabel("Příplatek (Kč)").fill("100");
    await page.getByLabel("Jak se příplatek počítá").selectOption("flat");
    await page
      .getByRole("button", { name: "Uložit příplatek", exact: true })
      .click();
    await expect(page.getByText("Příplatek za doprovod uložen.")).toBeVisible();
  });
  test("mobile navigation keeps common work visible and keyboard opens advanced tools", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/memberships");
    await page.getByRole("button", { name: /Menu administrace/ }).click();
    await expect(
      page.getByRole("link", { name: "Ceník a doprovod", exact: true }),
    ).toBeVisible();
    const tools = page.getByText("Další nástroje", { exact: true });
    await tools.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("link", { name: "Otevírací doba a bloky", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: /Menu administrace/ }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
});

test("booking requires people choice and updates the amount before checkout", async ({
  page,
}) => {
  const date = addDaysToDateKey(dateKeyInTimeZone(new Date()), 4);
  const start = localDateTimeToDate(date, 1125).toISOString();
  await page.goto(`/rezervace/udaje?start=${encodeURIComponent(start)}`);
  await page.getByLabel("Jméno", { exact: true }).fill("Dana");
  await page.getByLabel("Příjmení").fill("Doprovodová");
  await page.getByLabel("E-mail").fill("browser-doprovod@example.test");
  await page.getByLabel("Telefon", { exact: true }).fill("+420777000111");
  await page.getByRole("checkbox", { name: /Souhlasím s provozním/ }).check();
  await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
  await expect(
    page.getByText("Vyberte, kolik lidí přijde.", { exact: true }),
  ).toBeVisible();
  const [price] =
    await sql`select value from site_setting where key = 'pricing.entry_price_cents'`;
  const base = Number(price!.value);
  await page
    .getByRole("radio", { name: "Přijdu + 2 osoby", exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: /Pokračovat k platbě/ }),
  ).toContainText(String((base + 10000) / 100));
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
    await sql`select extra_people, price_cents from reservation where contact_email = 'browser-doprovod@example.test'`;
  expect(booking!.extra_people).toBe(2);
  expect(booking!.price_cents).toBe(base + 10000);
});

test.describe("paid companion addition from account", () => {
  test.use({ storageState: memberState });
  test("payment grants +2 once, preserves the original reservation and sends no email", async ({
    page,
    browser,
  }) => {
    const [member] =
      await sql`select id from profiles where email = 'member@example.test'`;
    const start = localDateTimeToDate(
      addDaysToDateKey(dateKeyInTimeZone(new Date()), 1),
      600,
    );
    const [booking] =
      await sql`insert into reservation (user_id, starts_at, ends_at, status, price_cents, contact_name, contact_email)
      values (${member!.id}, ${start}, ${new Date(start.getTime() + 75 * 60_000)}, 'confirmed', 22900, 'Doprovod Test', 'member@example.test') returning *`;
    const before =
      await sql`select * from reservation where id = ${booking!.id}`;
    const [emails] = await sql`select count(*)::int as n from email_archive`;
    await page.goto("/account");
    // The route is independently owner-checked; direct navigation isolates this fixture.
    await page.goto(`/account/rezervace/${booking!.id}/osoby`);
    await page.getByLabel("Celkový doprovod v rezervaci").selectOption("2");
    await expect(
      page.getByRole("status").filter({ hasText: "Doplatek:" }),
    ).toContainText("100");
    await page.route("https://payments.comgate.cz/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<h1>Lokální doplatek</h1>",
      });
    });
    await page.getByRole("button", { name: /Zaplatit doplatek/ }).click();
    await expect(page).toHaveURL(/payments.comgate.cz/);
    const [attempt] =
      await sql`select p.provider_payment_id, a.id from participant_addition a join payment p on p.participant_addition_id = a.id where a.reservation_id = ${booking!.id}`;
    expect(
      (
        await sql`select extra_people from reservation where id = ${booking!.id}`
      )[0]!.extra_people,
    ).toBe(0);
    gateway.settle(attempt!.provider_payment_id, "PAID");
    await page.goto(
      `/account/rezervace/${booking!.id}/osoby?addition_id=${attempt!.id}`,
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Doprovod je přidaný" }),
    ).toBeVisible();
    await page.reload();
    const [after] =
      await sql`select * from reservation where id = ${booking!.id}`;
    expect(after!.extra_people).toBe(2);
    expect(after!.additional_people_paid_cents).toBe(10000);
    for (const field of [
      "starts_at",
      "ends_at",
      "price_cents",
      "status",
      "confirmation_token_hash",
    ])
      expect(after![field]).toEqual(before[0]![field]);
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emails!.n);
    await page.goto("/account?tab=orders");
    await expect(page.getByText(/doplatek za doprovod 100/)).toBeVisible();
    const admin = await browser.newContext({ storageState: adminState });
    const calendar = await admin.newPage();
    await calendar.goto("/admin/calendar");
    await expect(
      calendar.getByText("Doprovod Test +2", { exact: true }),
    ).toBeVisible();
    await admin.close();
  });
});
