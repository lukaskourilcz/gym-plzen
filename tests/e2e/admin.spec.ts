import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { supabaseConfigured } from "./global-setup";
import postgres from "postgres";
import { isTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const sql = isTestDatabaseUrl(process.env.TEST_DATABASE_URL)
  ? postgres(process.env.TEST_DATABASE_URL!, { prepare: false, max: 1 })
  : null;
test.afterAll(async () => {
  await sql?.end({ timeout: 2 });
});

// Admin flows need a real Supabase session; skip when Supabase isn't configured.
test.skip(
  !supabaseConfigured(),
  "requires a configured Supabase (auth) instance",
);

// All tests in this file run as the admin.
test.use({
  storageState: join(process.cwd(), "tests", "e2e", ".auth", "admin.json"),
});

/** Future datetime-local value (next week at a fixed hour). */
function futureSlot(hour: number) {
  const day = addDaysToDateKey(dateKeyInTimeZone(new Date()), 7);
  return {
    start: `${day}T${String(hour).padStart(2, "0")}:00`,
    end: `${day}T${String(hour + 1).padStart(2, "0")}:15`,
    date: localDateTimeToDate(day, hour * 60),
  };
}

const ADMIN_PAGES: { path: string; heading: RegExp }[] = [
  { path: "/admin", heading: /Dnes/i },
  { path: "/admin/calendar", heading: /Kalendář/i },
  { path: "/admin/reservations", heading: /Rezervace/i },
  { path: "/admin/schedule", heading: /Otevírací doba/i },
  { path: "/admin/members", heading: /Členové/i },
  { path: "/admin/memberships", heading: /Vstupné a věrnost/i },
  { path: "/admin/statistics", heading: /Statistiky/i },
  { path: "/admin/content", heading: /Obsah webu/i },
  { path: "/admin/settings", heading: /Nastavení a branding/i },
  { path: "/admin/messages", heading: /Odeslané zprávy/i },
  { path: "/admin/activity", heading: /Historie akcí/i },
  { path: "/admin/entry-log", heading: /Kniha vstupů/i },
  { path: "/admin/alerts", heading: /Upozornění/i },
  { path: "/admin/access-codes", heading: /Vstupní kódy/i },
  { path: "/admin/vouchers", heading: /Vouchery/i },
  { path: "/admin/newsletter", heading: /Odběratelé novinek/i },
  { path: "/admin/doklady", heading: /^Doklady$/i },
  { path: "/admin/emails", heading: /^E-maily$/i },
  { path: "/admin/tomorrow", heading: /Zítra/i },
  { path: "/admin/finance", heading: /Finance/i },
  { path: "/admin/how-it-works", heading: /Jak co funguje/i },
];

test.describe("Admin : pages load", () => {
  for (const p of ADMIN_PAGES) {
    test(`loads ${p.path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      const response = await page.goto(p.path);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: p.heading }).first(),
      ).toBeVisible();
      expect(errors, `console page errors on ${p.path}`).toEqual([]);
    });
  }

  test("calendar renders FullCalendar", async ({ page }) => {
    await page.goto("/admin/calendar");
    await expect(page.locator(".fc")).toBeVisible();
  });
});

test.describe("Admin : forms", () => {
  test("content editor saves a block", async ({ page }) => {
    await page.goto("/admin/content");
    const hero = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Hero", exact: true }),
    });
    await hero
      .getByRole("button", { name: "Upravit: Hlavní nadpis", exact: true })
      .click();
    const textarea = page.locator('textarea[name="valueText"]');
    await expect(textarea).toBeVisible();
    const original = await textarea.inputValue();
    await textarea.fill("Upravený text E2E");
    await page.getByRole("button", { name: /Uložit změny/i }).click();
    await expect(
      page.getByText("Text je uložený a projeví se na webu."),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Upravený text E2E", { exact: true }),
    ).toBeVisible();
    await hero
      .getByRole("button", { name: "Upravit: Hlavní nadpis", exact: true })
      .click();
    await textarea.fill(original);
    await page.getByRole("button", { name: /Uložit změny/i }).click();
    await expect(
      page.getByText("Text je uložený a projeví se na webu."),
    ).toBeVisible();
  });

  test("pricing form saves the entry price", async ({ page }) => {
    await page.goto("/admin/memberships", { waitUntil: "networkidle" });
    const input = page.getByLabel(/Cena jednorázového vstupu/i);
    const original = await input.inputValue();
    await input.fill("300");
    await page.getByRole("button", { name: /Uložit cenu/i }).click();
    await expect(page.getByText(/Cena vstupného uložena/i)).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(input).toHaveValue("300");
    await input.fill(original);
    await page.getByRole("button", { name: /Uložit cenu/i }).click();
    await expect(page.getByText(/Cena vstupného uložena/i)).toBeVisible();
    await expect
      .poll(async () => {
        const [saved] = await sql!<
          { value: number }[]
        >`select value from site_setting where key = 'pricing.entry_price_cents'`;
        return saved?.value;
      })
      .toBe(Number(original) * 100);
  });

  test("settings saves the SMS template", async ({ page }) => {
    await page.goto("/admin/settings");
    const ta = page.getByLabel(/Text SMS s kódem/i);
    await ta.fill("Kod: {code} v {time}");
    await page.getByRole("button", { name: /Uložit šablonu/i }).click();
    await expect(page.getByText(/Šablona uložena/i)).toBeVisible();
  });

  test("schedule adds a blocked slot", async ({ page }) => {
    await page.goto("/admin/schedule");
    const { start, end, date } = futureSlot(13);
    // The blocked-slot form is the one with a "Přidat blok" button.
    const form = page.locator("form").filter({ hasText: "Přidat blok" });
    await form.locator('input[type="datetime-local"]').first().fill(start);
    await form.locator('input[type="datetime-local"]').nth(1).fill(end);
    await form.getByRole("button", { name: /Přidat blok/i }).click();
    await expect(page.getByText(/Blok vytvořen|Úklid/i).first()).toBeVisible();
    const [created] = await sql!<{ id: string }[]>`
      select id from blocked_slot where starts_at = ${date}`;
    expect(created?.id).toBeTruthy();
    await page.reload();
    await page.getByRole("button", { name: "Odstranit", exact: true }).click();
    await expect
      .poll(async () => {
        const [remaining] = await sql!<{ count: number }[]>`
        select count(*)::int as count from blocked_slot where id = ${created!.id}`;
        return remaining?.count;
      })
      .toBe(0);
  });

  test("a voucher is created, deactivated and reactivated", async ({
    page,
  }) => {
    await page.goto("/admin/vouchers");
    await page.getByLabel("Kód voucheru").fill("E2EAUDIT25");
    await page.getByLabel("Sleva (%)").fill("25");
    await page.getByLabel("Maximální počet použití").fill("1");
    await page.getByRole("button", { name: "Vytvořit voucher" }).click();
    await expect(page.getByText("Voucher byl vytvořen.")).toBeVisible();
    await page.reload();
    const row = page.getByRole("row").filter({ hasText: "E2EAUDIT25" });
    await expect(row).toContainText("25 %");
    await expect(row).toContainText("1");
    await row.getByRole("button", { name: "Deaktivovat" }).click();
    await expect(row).toContainText("Neaktivní");
    const [inactive] = await sql!<{ is_active: boolean }[]>`
      select is_active from voucher where code = 'E2EAUDIT25'`;
    expect(inactive?.is_active).toBe(false);
    await row.getByRole("button", { name: "Aktivovat" }).click();
    await expect(row).toContainText("Aktivní");
  });

  test("an operator resolves only the selected alert", async ({ page }) => {
    const [created] = await sql!<{ id: string }[]>`
      insert into system_alert (title, body, dedupe_key)
      values ('Lokální kontrola E2E', 'Pouze lokální test.', 'e2e:audit:alert')
      returning id`;
    await page.goto("/admin/alerts");
    const row = page
      .getByRole("row")
      .filter({ hasText: "Lokální kontrola E2E" });
    await row
      .getByRole("button", {
        name: "Označit jako vyřešené: Lokální kontrola E2E",
      })
      .click();
    await expect
      .poll(async () => {
        const [saved] = await sql!<{ resolved: boolean }[]>`
        select resolved_at is not null as resolved from system_alert where id = ${created!.id}`;
        return saved?.resolved;
      })
      .toBe(true);
  });

  test("reservations : admin creates a manual booking", async ({ page }) => {
    await page.goto("/admin/reservations");
    const { start, date } = futureSlot(10);
    const form = page.locator("form").filter({ hasText: "Vytvořit rezervaci" });
    await form.locator('input[type="datetime-local"]').first().fill(start);
    await form.getByLabel(/Jméno zákazníka/i).fill("E2E Zákazník");
    await form.getByLabel(/E-mail/i).fill("e2e@example.test");
    await form.getByRole("button", { name: /Vytvořit rezervaci/i }).click();
    await expect(page.getByText(/Rezervace vytvořena/i)).toBeVisible();
    // The new booking appears in the list.
    await expect(page.getByText("E2E Zákazník").first()).toBeVisible();
    if (sql) {
      const [row] = await sql<
        { id: string; status: string; starts_at: Date; ends_at: Date }[]
      >`
        select id, status, starts_at, ends_at from reservation where contact_email = 'e2e@example.test' order by created_at desc limit 1`;
      expect(row?.status).toBe("confirmed");
      expect(row?.starts_at.getTime()).toBe(date.getTime());
      expect(row!.ends_at.getTime() - row!.starts_at.getTime()).toBe(
        75 * 60_000,
      );
      const cancel = page
        .getByRole("row")
        .filter({ hasText: "E2E Zákazník" })
        .getByRole("button", { name: /^Zrušit rezervaci / });
      await cancel.click();
      await expect(
        page.getByText("Zákazníkovi odejde e-mail o zrušení."),
      ).toBeVisible();
      await page.getByRole("button", { name: "Ponechat", exact: true }).click();
      const [kept] = await sql<
        { status: string }[]
      >`select status from reservation where id = ${row!.id}`;
      expect(kept?.status).toBe("confirmed");
      await cancel.click();
      await page
        .getByLabel("Důvod pro zákazníka (nepovinné)")
        .fill("Lokální E2E audit");
      await page.getByRole("button", { name: "Ano, zrušit rezervaci" }).click();
      await expect(
        page.getByText("Rezervace zrušena.", { exact: true }),
      ).toBeVisible();
      const [cancelled] = await sql<
        { status: string }[]
      >`select status from reservation where id = ${row!.id}`;
      expect(cancelled?.status).toBe("cancelled");
    }
  });
});
