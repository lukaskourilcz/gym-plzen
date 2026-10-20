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
        page.getByRole("button", { name: new RegExp(`10:00.*${amount}`) }),
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
