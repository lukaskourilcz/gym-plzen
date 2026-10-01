import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import postgres from "postgres";
import { isTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
} from "../../src/lib/helpers/datetime";

// Fixtures and mutations are allowed only in the disposable loopback database.
const isolated =
  process.env.E2E_LOCAL_AUTH === "true" &&
  isTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const sql = isolated
  ? postgres(process.env.TEST_DATABASE_URL!, { prepare: false, max: 1 })
  : null;
const id = "88888888-8888-4888-8888-888888888888";
const email = "list-filter-fixture@example.test";
const prefix = "e2e-list-filter-";
const day = addDaysToDateKey(dateKeyInTimeZone(new Date()), -2);

test.describe("admin filtering and pagination", () => {
  test.skip(!isolated, "requires the isolated local Auth/database runner");
  test.use({
    storageState: join(process.cwd(), "tests", "e2e", ".auth", "admin.json"),
  });
  test.beforeAll(async () => {
    await sql!`insert into profiles(id,email,full_name,notify_by_whatsapp,created_at)
      select md5('e2e-sort-member-'||n)::uuid,'sort-member-'||n||'@example.test','Sort Member '||lpad(n::text,2,'0'),n%2=0,now()-n*interval '1 day' from generate_series(1,26) n`;
    await sql!`insert into profiles (id,email,full_name,role) values (${id},${email},'Paginationová Klientka','member')`;
    await sql!`insert into email_archive (provider_message_id,sender,recipient,subject,html,sent_at)
      select ${prefix}||n,'sender@example.test',${email},'Paging '||n,'Local fixture only',now()-interval '2 days'+n*interval '1 second' from generate_series(1,205) n`;
    await sql!`insert into message_delivery (user_id,channel,kind,status,recipient,provider_message_id,created_at,sent_at)
      select ${id},'sms','reservation_confirmation',case when n%5=0 then 'failed'::message_status else 'sent'::message_status end,
      '+420777000111',${prefix}||n,now(),now()-interval '1 day' from generate_series(1,205) n`;
    await sql!`insert into reservation(id,user_id,starts_at,ends_at,status,contact_name,contact_email,price_cents)
      select md5('e2e-programme-'||n)::uuid,null,
        (date_trunc('day',now() at time zone 'Europe/Prague') at time zone 'Europe/Prague')+n*interval '20 minutes',
        (date_trunc('day',now() at time zone 'Europe/Prague') at time zone 'Europe/Prague')+n*interval '20 minutes'+interval '10 minutes',
        case when n=4 then 'cancelled'::reservation_status when n=5 then 'pending'::reservation_status when n=6 then 'completed'::reservation_status when n=7 then 'no_show'::reservation_status else 'confirmed'::reservation_status end,
        'e2e-programme-'||n,'programme-fixture@example.test',19900 from generate_series(0,7) n`;
    await sql!`insert into access_code(id,reservation_id,code_hash,valid_from,valid_until,status,created_at)
      select md5('e2e-programme-code-'||n)::uuid,md5('e2e-programme-'||n)::uuid,'LOCAL-FIXTURE',r.starts_at,r.ends_at+interval '15 minutes','expired',now()-interval '2 days'
      from generate_series(0,7) n join reservation r on r.id=md5('e2e-programme-'||n)::uuid`;
    await sql!`insert into message_delivery(user_id,reservation_id,channel,kind,status,recipient,sent_at)
      select null,md5('e2e-programme-'||n)::uuid,'email','access_code',case when n=3 then 'failed'::message_status else 'sent'::message_status end,'programme-fixture@example.test',case when n=3 then null else now()-interval '1 day' end from generate_series(0,3) n where n<>2`;
    await sql!`insert into entry_log(reservation_id,access_code_id,nuki_name,trigger,action,occurred_at)
      select md5('e2e-programme-'||n)::uuid,md5('e2e-programme-code-'||n)::uuid,'NAVI fixture-'||n,case when n=1 then 'app' else 'keypad' end,case when n>=2 then 'keypad_failure_224' else 'unlock' end,now() from generate_series(0,3) n`;
  });
  test.afterAll(async () => {
    if (!sql) return;
    await sql`delete from email_archive where provider_message_id like ${prefix + "%"}`;
    await sql`delete from message_delivery where user_id=${id}`;
    await sql`delete from message_delivery where reservation_id in (select id from reservation where contact_name like 'e2e-programme-%')`;
    await sql`delete from entry_log where reservation_id in (select id from reservation where contact_name like 'e2e-programme-%')`;
    await sql`delete from reservation where contact_name like 'e2e-programme-%'`;
    await sql`delete from profiles where id=${id} or email like 'sort-member-%@example.test'`;
    await sql.end({ timeout: 2 });
  });

  test("customer name search reaches both lists, independent pages retain filters and a new filter resets pages", async ({
    page,
  }) => {
    await page.goto("/admin/messages");
    await page.getByRole("searchbox", { name: "Hledat" }).fill("paginationova");
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    await expect(page.locator("table").nth(0).locator("tbody tr")).toHaveCount(
      20,
    );
    await expect(page.locator("table").nth(1).locator("tbody tr")).toHaveCount(
      20,
    );
    const emails = page.getByRole("navigation", {
      name: "Stránkování e-mailů",
    });
    const other = page.getByRole("navigation", {
      name: "Stránkování ostatních zpráv",
    });
    const firstSubject = await page
      .locator("table")
      .nth(0)
      .locator("tbody tr")
      .first()
      .innerText();
    await emails.getByRole("link", { name: "Další", exact: true }).click();
    await expect(page).toHaveURL(/q=paginationova.*emailPage=2/);
    expect(
      await page
        .locator("table")
        .nth(0)
        .locator("tbody tr")
        .first()
        .innerText(),
    ).not.toBe(firstSubject);
    await other.getByRole("link", { name: "Další", exact: true }).click();
    await expect(page).toHaveURL(/emailPage=2.*messagePage=2/);
    await page
      .getByRole("combobox", { name: "Kanál", exact: true })
      .selectOption("sms");
    await page
      .getByRole("combobox", { name: "Stav", exact: true })
      .selectOption("failed");
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    expect(new URL(page.url()).searchParams.has("emailPage")).toBe(false);
    expect(new URL(page.url()).searchParams.has("messagePage")).toBe(false);
    await expect(page.locator("table").nth(1).locator("tbody tr")).toHaveCount(
      20,
    );
    await expect(other).toBeVisible();
    await expect(
      page.getByText("Celkem záznamů: 41", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("table").nth(0)).not.toContainText("Paging");
  });

  test("sorting, 20/50/100 rows and complete counts are applied before independent pagination", async ({
    page,
  }) => {
    await page.goto("/admin/messages?q=paginationova");
    await expect(
      page.getByText("Celkem záznamů: 205", { exact: true }),
    ).toHaveCount(2);
    await page
      .getByRole("combobox", { name: "Řadit podle", exact: true })
      .selectOption("date");
    await page
      .getByRole("combobox", { name: "Směr řazení", exact: true })
      .selectOption("asc");
    for (const size of [20, 50, 100]) {
      await page
        .getByRole("combobox", { name: "Záznamů na stránku", exact: true })
        .selectOption(String(size));
      await page
        .getByRole("button", { name: "Filtrovat", exact: true })
        .click();
      await expect(
        page.locator("table").first().locator("tbody tr"),
      ).toHaveCount(size);
      await expect(
        page.locator("table").first().locator("tbody tr").first(),
      ).toContainText("Paging 1");
      await expect(
        page.getByText("Celkem záznamů: 205", { exact: true }),
      ).toHaveCount(2);
    }
    await page
      .getByRole("navigation", { name: "Stránkování e-mailů" })
      .getByRole("link", { name: "Další", exact: true })
      .click();
    await expect(
      page.locator("table").first().locator("tbody tr").first(),
    ).toContainText("Paging 101");
    expect(new URL(page.url()).searchParams.get("pageSize")).toBe("100");
    expect(new URL(page.url()).searchParams.get("direction")).toBe("asc");
    await page
      .getByRole("combobox", { name: "Směr řazení", exact: true })
      .selectOption("desc");
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    expect(new URL(page.url()).searchParams.has("emailPage")).toBe(false);
    await expect(
      page.locator("table").first().locator("tbody tr").first(),
    ).toContainText("Paging 205");
  });

  test("members filter WhatsApp preferences, sort names and count all matching members", async ({
    page,
  }) => {
    await page.goto("/admin/members?q=sort-member");
    await expect(page.locator("tbody tr")).toHaveCount(20);
    await expect(
      page.getByText("Celkem členů: 26", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "WhatsApp", exact: true })
      .selectOption("enabled");
    await page
      .getByRole("combobox", { name: "Řadit podle", exact: true })
      .selectOption("name");
    await page
      .getByRole("combobox", { name: "Směr řazení", exact: true })
      .selectOption("asc");
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(13);
    await expect(
      page.getByText("Celkem členů: 13", { exact: true }),
    ).toBeVisible();
    await expect(page.locator("tbody tr").first()).toContainText(
      "Sort Member 02",
    );
    await expect(page.locator("tbody tr").last()).toContainText(
      "Sort Member 26",
    );
    await page
      .getByRole("combobox", { name: "WhatsApp", exact: true })
      .selectOption("disabled");
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    await expect(page.locator("tbody tr")).toHaveCount(13);
    await expect(page.locator("tbody tr").first()).toContainText(
      "Sort Member 01",
    );
  });

  test("today contains confirmed bookings only, marks sent codes and turns verified keypad use green", async ({
    page,
  }, testInfo) => {
    await page.goto("/admin");
    const programme = page.locator(
      'section[aria-labelledby="today-programme"]',
    );
    const card = (n: number) =>
      programme
        .getByText(`e2e-programme-${n}`, { exact: true })
        .locator("..")
        .locator("..");
    for (const n of [0, 1, 2, 3])
      await expect(
        programme.getByText(`e2e-programme-${n}`, { exact: true }),
      ).toBeVisible();
    for (const n of [4, 5, 6, 7])
      await expect(
        programme.getByText(`e2e-programme-${n}`, { exact: true }),
      ).toHaveCount(0);
    await expect(card(0)).toContainText("Kód odeslán");
    await expect(card(0)).toContainText("Kód použit");
    await expect(card(0)).toHaveClass(/bg-success\/10/);
    await expect(card(1)).toContainText("Kód odeslán");
    for (const n of [1, 2, 3]) {
      await expect(card(n)).not.toContainText("Kód použit");
      await expect(card(n)).not.toHaveClass(/bg-success\/10/);
    }
    for (const n of [2, 3])
      await expect(card(n)).not.toContainText("Kód odeslán");
    const entries = page.locator('section[aria-labelledby="today-entries"]');
    for (const n of [0, 1, 2, 3])
      await expect(
        entries.getByText(`NAVI fixture-${n} (e2e-programme-${n})`, {
          exact: true,
        }),
      ).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .include('section[aria-labelledby="today-programme"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("programme-code-states.png"),
    });
  });

  test("sent-day filter, invalid range and reset work through the GET form", async ({
    page,
  }) => {
    await page.goto("/admin/messages?q=paginationova");
    await page.getByLabel("Odesláno od", { exact: true }).fill(day);
    await page.getByLabel("Odesláno do", { exact: true }).fill(day);
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    await expect(page.locator("table").nth(0).locator("tbody tr")).toHaveCount(
      20,
    );
    await expect(page.locator("table").nth(1)).not.toContainText("SMS");
    await page
      .getByLabel("Odesláno od", { exact: true })
      .fill(addDaysToDateKey(day, 1));
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    await expect(
      page.getByRole("form", { name: "Filtry" }).getByRole("alert"),
    ).toContainText("platné období");
    await expect(page.locator("table").nth(0)).not.toContainText("Paging");
    await page
      .getByRole("link", { name: "Zrušit filtry", exact: true })
      .click();
    await expect(page).toHaveURL(/\/admin\/messages$/);
    await expect(page.getByRole("searchbox", { name: "Hledat" })).toHaveValue(
      "",
    );
  });

  test("filters remain labelled, usable and within the viewport on desktop and mobile", async ({
    page,
  }, testInfo) => {
    for (const width of [1920, 1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/messages?q=paginationova");
      await expect(
        page.getByRole("searchbox", { name: "Hledat" }),
      ).toBeVisible();
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ).toEqual([]);
      const form = page.getByRole("form", { name: "Filtry" });
      const box = await form.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      const main = await page.locator("main").boundingBox();
      expect(main!.width).toBe(width >= 1024 ? width - 248 : width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: testInfo.outputPath(`messages-${width}.png`),
      });
    }
  });

  test("filtered URLs expose no admin data to anonymous visitors or members", async ({
    browser,
  }) => {
    for (const state of [null, "member"] as const) {
      const context = await browser.newContext(
        state
          ? {
              storageState: join(
                process.cwd(),
                "tests",
                "e2e",
                ".auth",
                `${state}.json`,
              ),
            }
          : { storageState: { cookies: [], origins: [] } },
      );
      try {
        const page = await context.newPage();
        await page.goto("/admin/messages?q=paginationova&emailPage=2");
        await expect(page).toHaveURL(state ? /\/account/ : /\/login/);
        await expect(page.getByText(email, { exact: true })).toHaveCount(0);
      } finally {
        await context.close();
      }
    }
  });
});
