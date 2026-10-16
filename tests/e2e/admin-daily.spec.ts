import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
const prefix = `daily-${randomUUID()}`;
const memberId = randomUUID();
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
async function unchanged(before: unknown[], emails: number) {
  expect(await sql`select * from reservation order by id`).toEqual(before);
  expect((await sql`select count(*)::int as n from email_archive`)[0]!.n).toBe(
    emails,
  );
}

test("tomorrow offers a desktop table, icon tooltips and mobile cards without changing bookings", async ({
  page,
}) => {
  const tomorrow = addDaysToDateKey(dateKeyInTimeZone(new Date()), 1);
  await sql`insert into profiles(id,email,full_name,phone,notify_by_whatsapp,note) values (${memberId},${prefix + "@example.test"},'Zítřejší klient','+420777000111',true,'Poznámka do zítřejšího přehledu')`;
  const start = localDateTimeToDate(tomorrow, 600);
  const [booking] =
    await sql`insert into reservation(user_id,starts_at,ends_at,status,contact_name,contact_email)
    values (${memberId},${start},${new Date(start.getTime() + 75 * 60_000)},'confirmed',${prefix + " member"},${prefix + "@example.test"}) returning id`;
  const pendingStart = localDateTimeToDate(tomorrow, 675);
  const [pending] =
    await sql`insert into reservation(starts_at,ends_at,status,contact_name)
    values (${pendingStart},${new Date(pendingStart.getTime() + 75 * 60_000)},'pending',${prefix + " guest"}) returning id`;
  const before = await sql`select * from reservation order by id`;
  const [emails] = await sql`select count(*)::int as n from email_archive`;
  try {
    await page.goto("/admin/tomorrow");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /^Zítra \| kontrola rezervací na/,
    );
    await expect(page.getByText(/Tady večer uvidíte/)).toHaveCount(0);
    const table = page.getByRole("table");
    await expect(table).toBeVisible();
    expect(await table.getByRole("columnheader").allTextContents()).toEqual([
      "Čas",
      "Jméno",
      "Nuki kód",
      "Email",
      "Whatsapp",
      "Potvrzeno",
      "Rezervace",
      "Profil zákazníka",
    ]);
    const row = table.getByRole("row").filter({ hasText: prefix + " member" });
    await expect(
      row.getByRole("link", { name: prefix + " member", exact: true }),
    ).toHaveAttribute("href", `/admin/members/${memberId}`);
    await expect(
      row.getByRole("img", { name: "Používá se", exact: true }),
    ).toBeVisible();
    await expect(
      row.getByRole("img", { name: "Potvrzeno", exact: true }),
    ).toBeVisible();
    await expect(row.getByText("Hodinu předem", { exact: true })).toBeVisible();
    await row.getByRole("link", { name: "Rezervace", exact: true }).focus();
    await expect(page.getByRole("tooltip")).toHaveText("Rezervace");
    await page.keyboard.press("Escape");
    await row
      .getByRole("link", { name: "Profil zákazníka", exact: true })
      .focus();
    await expect(page.getByRole("tooltip")).toHaveText("Profil zákazníka");
    await page.keyboard.press("Escape");
    await expect(
      row.getByRole("button", { name: /Poznámka k zákazníkovi/ }),
    ).toBeVisible();
    const guest = table.getByRole("row").filter({ hasText: prefix + " guest" });
    await expect(
      guest.getByRole("img", { name: "Nepoužívá se", exact: true }),
    ).toBeVisible();
    await expect(
      guest.getByRole("link", { name: "Profil zákazníka", exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "/tmp/gym-admin-tomorrow-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(table).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Rezervace", exact: true }),
    ).toHaveCount(2);
    await expect(
      page.getByRole("img", { name: "Používá se", exact: true }),
    ).toBeVisible();
    expect(
      await page
        .locator("body")
        .evaluate((el) => el.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "/tmp/gym-admin-tomorrow-mobile.png",
      fullPage: true,
    });
    await page
      .getByRole("link", { name: prefix + " member", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/members/${memberId}$`));
    await unchanged(before, emails!.n);
  } finally {
    await sql`delete from reservation where id in (${booking!.id},${pending!.id})`;
    await sql`delete from profiles where id=${memberId}`;
  }
});

test("today paginates all entries by twenty and uses compact gaps beside a long programme", async ({
  page,
}) => {
  const today = dateKeyInTimeZone(new Date());
  const dayStart = localDateTimeToDate(today, 0);
  const [registered] =
    await sql`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
  expect(registered).toBeTruthy();
  for (let n = 0; n < 25; n++) {
    const start = localDateTimeToDate(today, n * 30);
    await sql`insert into reservation(user_id,starts_at,ends_at,status,contact_name,contact_email) values (${n === 0 ? registered!.id : null},${start},${new Date(start.getTime() + 20 * 60_000)},'confirmed',${prefix + " programme " + n},${prefix + "@example.test"})`;
  }
  for (let n = 0; n < 23; n++)
    await sql`insert into entry_log(nuki_log_id,nuki_name,action,trigger,occurred_at) values (${prefix + "-" + n},${"Denní vstup " + String(n).padStart(2, "0")},'unlock','keypad',${localDateTimeToDate(today, n * 55)})`;
  await sql`insert into entry_log(nuki_log_id,nuki_name,action,occurred_at) values (${prefix + "-before"},'Vstup před dneškem','unlock',${new Date(dayStart.getTime() - 1000)})`;
  const before = await sql`select * from reservation order by id`;
  const [emails] = await sql`select count(*)::int as n from email_archive`;
  try {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /^Dnes \| /,
    );
    const programme = page.locator(
      'section[aria-labelledby="today-programme"]',
    );
    await expect(
      programme.getByRole("link", {
        name: prefix + " programme 0",
        exact: true,
      }),
    ).toHaveAttribute("href", `/admin/members/${registered!.id}`);
    await expect(
      programme.getByRole("link", {
        name: prefix + " programme 1",
        exact: true,
      }),
    ).toHaveCount(0);
    const entries = page.locator('section[aria-labelledby="today-entries"]');
    await expect(entries.getByText(/^Denní vstup/)).toHaveCount(20);
    await expect(
      entries.getByText("Denní vstup 22", { exact: true }),
    ).toBeVisible();
    await expect(
      entries.getByText("Denní vstup 00", { exact: true }),
    ).toHaveCount(0);
    await expect(
      entries.getByText("Vstup před dneškem", { exact: true }),
    ).toHaveCount(0);
    const nav = entries.getByRole("navigation", {
      name: "Stránkování dnešních vstupů",
    });
    await nav.getByRole("link", { name: "Další", exact: true }).click();
    await expect(entries.getByText(/^Denní vstup/)).toHaveCount(3);
    await expect(
      entries.getByText("Denní vstup 00", { exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: "Další", exact: true }),
    ).toHaveCount(0);
    const gaps = await page.evaluate(() => {
      const sections = ["today-entries", "week-kpis", "today-activity"].map(
        (id) =>
          document
            .querySelector(`section[aria-labelledby="${id}"]`)!
            .getBoundingClientRect(),
      );
      const programme = document
        .querySelector('section[aria-labelledby="today-programme"]')!
        .getBoundingClientRect();
      return {
        vertical: [
          sections[1]!.top - sections[0]!.bottom,
          sections[2]!.top - sections[1]!.bottom,
        ],
        horizontal: sections[0]!.left - programme.right,
      };
    });
    for (const gap of gaps.vertical) {
      expect(gap).toBeGreaterThan(0);
      expect(Math.abs(gap - gaps.horizontal)).toBeLessThan(2);
    }
    await page.screenshot({
      path: "/tmp/gym-admin-today-pagination.png",
      fullPage: true,
    });
    await nav.getByRole("link", { name: "Předchozí", exact: true }).click();
    await expect(entries.getByText(/^Denní vstup/)).toHaveCount(20);
    await programme
      .getByRole("link", { name: prefix + " programme 0", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/members/${registered!.id}$`),
    );
    await unchanged(before, emails!.n);
  } finally {
    await sql`delete from entry_log where nuki_log_id like ${prefix + "-%"}`;
    await sql`delete from reservation where contact_name like ${prefix + " programme %"}`;
  }
});

test("pricing period creation opens a keyboard dialog and saves only the local price period", async ({
  page,
}) => {
  const today = dateKeyInTimeZone(new Date());
  const name = prefix + " období";
  const from = addDaysToDateKey(today, 60),
    to = addDaysToDateKey(today, 65);
  const before = await sql`select * from reservation order by id`;
  const [emails] = await sql`select count(*)::int as n from email_archive`;
  try {
    await page.goto("/admin/memberships");
    await expect(page.getByLabel("Název období", { exact: true })).toHaveCount(
      0,
    );
    const trigger = page.getByRole("button", {
      name: "Přidat období",
      exact: true,
    });
    await trigger.focus();
    await trigger.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Přidat cenové období",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByLabel("Název období", { exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByLabel("Název období", { exact: true }).fill(name);
    await dialog.getByLabel("Cena rezervace (Kč)", { exact: true }).fill("299");
    await dialog.getByLabel("Platí od (včetně)", { exact: true }).fill(from);
    await dialog.getByLabel("Platí do (včetně)", { exact: true }).fill(to);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "/tmp/gym-admin-price-period-dialog.png",
      fullPage: true,
    });
    await dialog
      .getByRole("button", { name: "Přidat období", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    const [period] = await sql`select * from pricing_period where name=${name}`;
    expect(period!.price_cents).toBe(29900);
    expect(period!.starts_at).toEqual(localDateTimeToDate(from, 0));
    expect(period!.ends_at).toEqual(
      localDateTimeToDate(addDaysToDateKey(to, 1), 0),
    );
    // The existing edit flow remains available and does not duplicate form IDs in a dialog.
    await page.goto(`/admin/memberships?edit=${period!.id}#price-period-form`);
    await expect(page.getByLabel("Název období", { exact: true })).toHaveValue(
      name,
    );
    await page
      .getByRole("button", { name: "Přidat období", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Název období", { exact: true }),
    ).toHaveValue("");
    expect(
      await page
        .locator("[id]")
        .evaluateAll(
          (nodes) => new Set(nodes.map((n) => n.id)).size === nodes.length,
        ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await unchanged(before, emails!.n);
  } finally {
    await sql`delete from pricing_period where name=${name}`;
  }
});

test("how-it-works removes only the requested section and its contents link", async ({
  page,
}) => {
  await page.goto("/admin/how-it-works");
  await expect(
    page.getByText("Co najdu v administraci", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Jak číst dva pohledy ve Financích?", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('a[href="#administrace"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Když něco nefunguje", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Rezervace v pěti krocích",
      exact: true,
    }),
  ).toBeVisible();
});
