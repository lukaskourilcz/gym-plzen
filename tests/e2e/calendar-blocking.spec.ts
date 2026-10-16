import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
async function begin(page: import("@playwright/test").Page) {
  await page.goto("/admin/calendar");
  await page.getByRole("button", { name: "Další období", exact: true }).click();
  await page
    .getByRole("button", { name: "Vybrat termíny k zablokování", exact: true })
    .click();
  await expect(page.locator(".admin-calendar-selecting")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Blokovat / }).first(),
  ).toBeVisible();
}
test("calendar selects real free windows using keyboard, saves a lost response once and exposes public occupied slots without customer side effects", async ({
  page,
  browser,
}) => {
  const before = await sql`select * from reservation order by id`,
    codes = await sql`select * from access_code order by id`,
    messages = await sql`select * from message_delivery order by id`,
    emails = await sql`select * from email_archive order by id`;
  let applicationId: string | undefined;
  let calendarReads = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      new URL(request.url()).pathname === "/admin/calendar"
    )
      calendarReads++;
  });
  try {
    await begin(page);
    const options = page.getByRole("button", { name: /^Blokovat / });
    await options.nth(0).press("Space");
    await expect(options.nth(0)).toHaveAttribute("aria-pressed", "true");
    await options.nth(1).click();
    await expect(
      page.getByText("Vybráno: 2 / 200", { exact: true }),
    ).toBeVisible();
    expect(
      calendarReads,
      "identical RSC events must not create a read loop",
    ).toBe(1);
    expect(
      (
        await new AxeBuilder({ page })
          .include(".admin-booking-calendar")
          .analyze()
      ).violations,
    ).toEqual([]);
    await expect(
      page.getByRole("button", {
        name: "Uložit blokované termíny",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(options.nth(0)).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({
      path: "/tmp/gym-calendar-selection-desktop.png",
      fullPage: true,
    });
    let lost = false;
    await page.route("**/admin/calendar**", async (route) => {
      if (route.request().method() !== "POST" || lost) return route.continue();
      lost = true;
      await route.fetch();
      await route.abort("connectionreset");
    });
    await page
      .getByRole("button", { name: "Uložit blokované termíny", exact: true })
      .click();
    await expect(
      page.locator(".admin-booking-calendar").getByRole("alert"),
    ).toContainText("Výsledek uložení se nepodařilo načíst");
    await expect(
      page.getByRole("button", { name: "Zrušit výběr", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Uložit blokované termíny", exact: true })
      .click();
    await expect(
      page.getByText("Uloženo 2 blokovaných termínů.", { exact: false }),
    ).toBeVisible();
    const applications =
      await sql`select id from block_application where snapshot->'templates'='[]'::jsonb order by created_at desc`;
    expect(applications.length).toBe(1);
    applicationId = applications[0]!.id;
    const blocks =
      await sql`select * from blocked_slot where application_id=${applicationId!} order by starts_at`;
    expect(blocks.length).toBe(2);
    const guest = await browser.newContext();
    try {
      const publicPage = await guest.newPage();
      const start = new Date(blocks[0]!.starts_at);
      const date = start.toLocaleDateString("sv-SE", {
        timeZone: "Europe/Prague",
      });
      const label = start.toLocaleTimeString("cs-CZ", {
        timeZone: "Europe/Prague",
        hour: "numeric",
        minute: "2-digit",
      });
      await publicPage.goto(`/rezervace?date=${date}`);
      await expect(
        publicPage.getByRole("button", {
          name: new RegExp(`${label}.*Obsazeno`),
        }),
      ).toBeDisabled();
    } finally {
      await guest.close();
    }
    await page.goto("/admin/blocking");
    await expect(
      page.getByText("Výběr v kalendáři", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Zrušit budoucí blokace", exact: true })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Zrušit budoucí blokace", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (
        await sql`select * from blocked_slot where application_id=${applicationId!}`
      ).length,
    ).toBe(0);
    expect(await sql`select * from reservation order by id`).toEqual(before);
    expect(await sql`select * from access_code order by id`).toEqual(codes);
    expect(await sql`select * from message_delivery order by id`).toEqual(
      messages,
    );
    expect(await sql`select * from email_archive order by id`).toEqual(emails);
  } finally {
    if (applicationId) {
      await sql`delete from blocked_slot where application_id=${applicationId}`;
      await sql`delete from block_application where id=${applicationId}`;
    }
  }
});
test("mobile selection retains choices across days and cancel writes nothing", async ({
  page,
}) => {
  const before = await sql`select * from block_application order by id`;
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  await page
    .getByRole("button", { name: /^Blokovat / })
    .first()
    .click();
  await expect(
    page.getByText("Vybráno: 1 / 200", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Další období", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Blokovat / }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^Blokovat / })
    .first()
    .click();
  await expect(
    page.getByText("Vybráno: 2 / 200", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: "/tmp/gym-calendar-selection-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Zrušit výběr", exact: true }).click();
  await expect(page.locator(".admin-calendar-selecting")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Blokovat / })).toHaveCount(0);
  expect(await sql`select * from block_application order by id`).toEqual(
    before,
  );
});
test("empty manual booking is rejected before it can create a reservation or customer messages", async ({
  page,
}) => {
  const before = await sql`select * from reservation order by id`;
  await page.goto("/admin/reservations");
  await page.getByLabel("Začátek", { exact: true }).fill("2027-01-10T05:00");
  await page
    .getByRole("button", { name: "Vytvořit rezervaci", exact: true })
    .click();
  await expect(
    page.getByText(
      "Vyplňte kontakt zákazníka. Pro blokaci použijte Kalendář.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(await sql`select * from reservation order by id`).toEqual(before);
});

test("availability read failure never offers guessed free slots and can be retried", async ({
  page,
}) => {
  const before = await sql`select * from block_application order by id`;
  await page.goto("/admin/calendar");
  await page.getByRole("button", { name: "Další období", exact: true }).click();
  let failed = false;
  await page.route("**/admin/calendar**", async (route) => {
    if (route.request().method() !== "POST" || failed) return route.continue();
    failed = true;
    await route.abort("connectionreset");
  });
  await page
    .getByRole("button", { name: "Vybrat termíny k zablokování", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Zkusit načíst znovu", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Blokovat / })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Uložit blokované termíny", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Zkusit načíst znovu", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Blokovat / }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Zrušit výběr", exact: true }).click();
  expect(await sql`select * from block_application order by id`).toEqual(
    before,
  );
});
