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
    await sql!`insert into profiles (id,email,full_name,role) values (${id},${email},'Paginationová Klientka','member')`;
    await sql!`insert into email_archive (provider_message_id,sender,recipient,subject,html,sent_at)
      select ${prefix}||n,'sender@example.test',${email},'Paging '||n,'Local fixture only',now()-interval '2 days' from generate_series(1,205) n`;
    await sql!`insert into message_delivery (user_id,channel,kind,status,recipient,provider_message_id,created_at,sent_at)
      select ${id},'sms','reservation_confirmation',case when n%5=0 then 'failed'::message_status else 'sent'::message_status end,
      '+420777000111',${prefix}||n,now(),now()-interval '1 day' from generate_series(1,205) n`;
  });
  test.afterAll(async () => {
    if (!sql) return;
    await sql`delete from email_archive where provider_message_id like ${prefix + "%"}`;
    await sql`delete from message_delivery where user_id=${id}`;
    await sql`delete from profiles where id=${id}`;
    await sql.end({ timeout: 2 });
  });

  test("customer name search reaches both lists, independent pages retain filters and a new filter resets pages", async ({
    page,
  }) => {
    await page.goto("/admin/messages");
    await page.getByRole("searchbox", { name: "Hledat" }).fill("paginationova");
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    await expect(page.locator("table").nth(0).locator("tbody tr")).toHaveCount(
      50,
    );
    await expect(page.locator("table").nth(1).locator("tbody tr")).toHaveCount(
      50,
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
      41,
    );
    await expect(other).toHaveCount(0);
    await expect(page.locator("table").nth(0)).not.toContainText("Paging");
  });

  test("sent-day filter, invalid range and reset work through the GET form", async ({
    page,
  }) => {
    await page.goto("/admin/messages?q=paginationova");
    await page.getByLabel("Odesláno od", { exact: true }).fill(day);
    await page.getByLabel("Odesláno do", { exact: true }).fill(day);
    await page.getByRole("button", { name: "Filtrovat", exact: true }).click();
    await expect(page.locator("table").nth(0).locator("tbody tr")).toHaveCount(
      50,
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
    for (const width of [1280, 390]) {
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
