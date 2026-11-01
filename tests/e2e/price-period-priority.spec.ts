import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});

test("homepage and CMS preview quote the cheapest configured block instead of the fallback", async ({
  page,
  browser,
}) => {
  const old =
    await sql`select key, value from site_setting where key in ('pricing.time_blocks','pricing.entry_price_cents')`;
  const periods = await sql`select * from pricing_period`;
  const admin = await browser.newContext({
    storageState: join(process.cwd(), "tests/e2e/.auth/admin.json"),
  });
  const adminPage = await admin.newPage();
  const savePrice = async (czk: number) => {
    await adminPage.goto("/admin/memberships");
    await adminPage
      .getByLabel("Cena jednorázového vstupu (Kč)", { exact: true })
      .fill(String(czk));
    await adminPage
      .getByRole("button", { name: "Uložit cenu", exact: true })
      .click();
    await expect(
      adminPage.getByText("Cena vstupného uložena.", { exact: true }),
    ).toBeVisible();
  };
  const before = await sql`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as bookings,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from access_code r) as codes,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from message_delivery r) as messages`;
  try {
    // Local fixture only: expired promotion must not mask this regression.
    await sql`delete from pricing_period`;
    const rules = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      id: randomUUID(),
      dayOfWeek,
      startMinute: 600,
      endMinute: 675,
      priceCents: 19900,
    }));
    for (const [key, value] of [
      ["pricing.time_blocks", rules],
      ["pricing.entry_price_cents", 23900],
    ] as const)
      await sql`insert into site_setting(key,value) values(${key},${sql.json(value)}) on conflict(key) do update set value=excluded.value`;
    // Exercise real administration invalidation instead of reading a stale
    // homepage prerender after changing the isolated database directly.
    await savePrice(239);
    await page.goto("/");
    await expect(page.getByTestId("pricing-card")).toContainText(/199\s*Kč/);
    await expect(page.getByTestId("pricing-card")).not.toContainText(
      /239\s*Kč/,
    );
    await adminPage.goto("/admin/content?section=pricing");
    await expect(
      adminPage
        .locator('[data-content-field="home.pricing.pricePrefix"]')
        .locator(".."),
    ).toContainText(/199\s*Kč/);
    expect(
      await sql`select
      (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as bookings,
      (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from access_code r) as codes,
      (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from message_delivery r) as messages`,
    ).toEqual(before);
  } finally {
    for (const key of ["pricing.time_blocks", "pricing.entry_price_cents"]) {
      const row = old.find((row) => row.key === key);
      if (row)
        await sql`update site_setting set value=${sql.json(row.value)} where key=${key}`;
      else await sql`delete from site_setting where key=${key}`;
    }
    for (const period of periods)
      await sql`insert into pricing_period ${sql(period, ...Object.keys(period))}`;
    try {
      await savePrice(
        Number(
          old.find((row) => row.key === "pricing.entry_price_cents")?.value ??
            22900,
        ) / 100,
      );
    } finally {
      await admin.close();
    }
  }
});

test("calendar and multi-date details use period priority, while admin explains the rule without customer changes", async ({
  page,
  browser,
}) => {
  const from = addDaysToDateKey(dateKeyInTimeZone(new Date()), 8),
    to = addDaysToDateKey(from, 1),
    periodId = randomUUID();
  const [old] =
    await sql`select value from site_setting where key='pricing.time_blocks'`;
  const before = await sql`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as bookings,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from access_code r) as codes,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from message_delivery r) as messages`;
  try {
    await sql`insert into pricing_period(id,name,price_cents,starts_at,ends_at) values(${periodId},'Synthetic date-price promotion',19900,${localDateTimeToDate(from, 0)},${localDateTimeToDate(to, 0)})`;
    const rules = Array.from({ length: 7 }, (_, dayOfWeek) => ({
      id: randomUUID(),
      dayOfWeek,
      startMinute: 600,
      endMinute: 675,
      priceCents: 32900,
    }));
    await sql`insert into site_setting(key,value) values('pricing.time_blocks',${sql.json(rules)}) on conflict(key) do update set value=excluded.value`;
    for (const [date, amount] of [
      [from, 199],
      [to, 329],
    ] as const) {
      await page.goto(`/rezervace?date=${date}`);
      await expect(
        page.getByRole("button", { name: new RegExp(`^10:00.*${amount}`) }),
      ).toBeVisible();
      const response = await page.request.get(
        `/api/availability/calendar?date=${date}`,
      );
      expect(response.status()).toBe(200);
      const view = await response.json();
      expect(
        view.selectedSlots.find(
          (s: { startISO: string }) =>
            s.startISO === localDateTimeToDate(date, 600).toISOString(),
        ).priceCents,
      ).toBe(amount * 100);
    }
    const params = new URLSearchParams();
    for (const date of [from, to])
      params.append("start", localDateTimeToDate(date, 600).toISOString());
    await page.goto(`/rezervace/udaje?${params}`);
    await expect(page.getByText(/199\s*Kč/).first()).toBeVisible();
    await expect(page.getByText(/329\s*Kč/).first()).toBeVisible();
    await expect(page.getByText(/528\s*Kč/).first()).toBeVisible();
    const admin = await browser.newContext({
      storageState: join(process.cwd(), "tests/e2e/.auth/admin.json"),
    });
    try {
      const adminPage = await admin.newPage();
      await adminPage.goto("/admin/memberships");
      await expect(
        adminPage.getByText(
          "Cena období má přednost před cenami časových bloků.",
          { exact: false },
        ),
      ).toBeVisible();
      await expect(
        adminPage.getByText(/Přednost má cenové období podle data návštěvy/),
      ).toBeVisible();
    } finally {
      await admin.close();
    }
    expect(
      await sql`select
      (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as bookings,
      (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from access_code r) as codes,
      (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from message_delivery r) as messages`,
    ).toEqual(before);
  } finally {
    await sql`delete from pricing_period where id=${periodId}`;
    if (old)
      await sql`update site_setting set value=${sql.json(old.value)} where key='pricing.time_blocks'`;
    else await sql`delete from site_setting where key='pricing.time_blocks'`;
  }
});
