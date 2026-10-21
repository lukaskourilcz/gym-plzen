import {
  addDaysToDateKey,
  dateKeyInTimeZone,
} from "../../src/lib/helpers/datetime";
import { expect, test } from "@playwright/test";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { BOOKING_TABLES } from "../helpers/booking-tables";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
async function businessState() {
  const result: Record<string, unknown> = {};
  for (const table of BOOKING_TABLES)
    result[table] = await sql.unsafe(
      `select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text), '')) as hash from public.${table} t`,
    );
  result.customers =
    await sql`select id, full_name, phone, email, role, notify_by_whatsapp from profiles where role <> 'admin' order by id`;
  return result;
}
test("customer preview is restricted to administrators", async ({
  page,
  browser,
}) => {
  await page.goto(
    "/customer-preview?screen=payment&start=2026-10-25T05:00:00Z",
  );
  await expect(page).toHaveURL(/\/login/);
  const member = await browser.newContext({
    storageState: join(process.cwd(), "tests/e2e/.auth/member.json"),
  });
  try {
    const memberPage = await member.newPage();
    await memberPage.goto("/customer-preview?screen=account");
    await expect(memberPage).toHaveURL(/\/account$/);
    await expect(memberPage.getByText("jana@preview.example.test")).toHaveCount(
      0,
    );
  } finally {
    await member.close();
  }
});
test.describe("isolated administrator walkthrough", () => {
  test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
  test("multi-slot booking, profile and simulated payment do not write business data or call providers", async ({
    page,
  }) => {
    await page.goto("/admin");
    const launch = page.getByRole("link", {
      name: "Ukázat web jako registrovaný zákazník",
    });
    await expect(launch).toHaveAttribute("href", "/customer-preview");
    await expect(launch).toHaveAttribute("target", "_blank");
    const before = await businessState();
    const dangerous: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" ||
        /comgate|resend|nuki|\/api\/availability|facebook|google-analytics|googletagmanager/.test(
          request.url(),
        )
      )
        dangerous.push(`${request.method()} ${request.url()}`);
    });
    const firstDate = addDaysToDateKey(dateKeyInTimeZone(new Date()), 2);
    const secondDate = addDaysToDateKey(firstDate, 1);
    await page.goto(`/customer-preview?date=${firstDate}`);
    await expect(
      page.getByRole("heading", { name: "Vyber datum a čas" }),
    ).toBeVisible();
    const freeSlots = page.getByRole("button", { name: /Vybrat$/ });
    await freeSlots.nth(0).click();
    await page.locator(`a[data-date="${secondDate}"]`).click();
    await freeSlots.nth(0).click();
    await expect(
      page.getByRole("region", { name: "Vybrané termíny" }),
    ).toContainText("2 termíny");
    await page.getByRole("link", { name: /Pokračovat/ }).click();
    await expect(
      page.getByRole("heading", { name: "Údaje a rekapitulace" }),
    ).toBeVisible();
    await expect(page.getByLabel("Jméno", { exact: true })).toHaveValue("Jana");
    if (await page.getByLabel("Přijdu sám / sama").count())
      await page.getByLabel("Přijdu sám / sama").check();
    await page.getByLabel(/Souhlasím/).check();
    await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
    await expect(
      page.getByRole("heading", { name: "Platba za rezervaci" }),
    ).toBeVisible();
    await expect(
      page.getByText("Simulace platby", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Simulovat úspěšnou platbu" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Rezervace je potvrzená" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Přejít do mého účtu" }).click();
    await expect(
      page.getByRole("heading", { name: "Ahoj, Jana" }),
    ).toBeVisible();
    await expect(page.getByText("Potvrzená", { exact: true })).toHaveCount(1);
    await page.getByLabel("Jméno", { exact: true }).fill("Petra");
    await page.getByRole("button", { name: "Uložit údaje" }).click();
    await expect(
      page.getByRole("heading", { name: "Ahoj, Petra" }),
    ).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    await page
      .getByRole("button", { name: "Zrušit ukázkovou rezervaci" })
      .click();
    await expect(
      page.getByText("Nemáš žádnou naplánovanou ukázkovou rezervaci."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Začít znovu" }).click();
    await expect(
      page.getByRole("heading", { name: "Vyber datum a čas" }),
    ).toBeVisible();
    expect(dangerous).toEqual([]);
    expect(await businessState()).toEqual(before);
  });
});
