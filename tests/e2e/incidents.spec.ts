import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { buildReservationIncident } from "../../src/lib/services/reservation-incidents";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
test("incidents explain the actual cause, link to the reservation/member/messages and keep technical details private until expanded", async ({
  page,
}) => {
  const id = randomUUID(),
    memberId = randomUUID(),
    prefix = `incident-${randomUUID()}`;
  const start = localDateTimeToDate(
      addDaysToDateKey(dateKeyInTimeZone(new Date()), 3),
      675,
    ),
    end = new Date(start.getTime() + 75 * 60000);
  await sql`insert into profiles(id,email,full_name) values(${memberId},${prefix + "@example.test"},${prefix})`;
  await sql`insert into reservation(id,user_id,starts_at,ends_at,status,contact_name) values(${id},${memberId},${start},${end},'confirmed',${prefix})`;
  const params = buildReservationIncident({
    booking: {
      id,
      userId: memberId,
      contactName: prefix,
      startsAt: start,
      endsAt: end,
    },
    step: "code_delivered",
    failure: { code: "contact_email_missing", detail: "recipient_missing" },
    attempts: 2,
    nextRetryAt: new Date(Date.now() + 60000),
  });
  const alertId = randomUUID(),
    legacyId = randomUUID(),
    messageId = randomUUID();
  await sql`insert into system_alert(id,title,body,severity,dedupe_key,context) values(${alertId},${params.title},${params.body!},'warning',${params.dedupeKey!},${sql.json(JSON.parse(JSON.stringify(params.context)))})`;
  await sql`insert into message_delivery(id,reservation_id,user_id,channel,kind,status,recipient,failure_reason) values(${messageId},${id},${memberId},'email','access_code','failed','synthetic@example.test','synthetic_failure_for_lookup')`;
  const before = await sql`select * from reservation order by id`,
    codes = await sql`select * from access_code order by id`,
    messages = await sql`select * from message_delivery order by id`,
    emails = await sql`select * from email_archive order by id`;
  try {
    await page.goto(`/admin/alerts?q=${id}`);
    const row = page.getByRole("row").filter({ hasText: prefix });
    await expect(row).toContainText("Chybí e-mail pro doručení vstupního kódu");
    await expect(row).toContainText("Příprava kódu může pokračovat");
    await expect(row).toContainText("Co udělat:");
    await expect(row).toContainText("Pokusy: 2");
    await expect(
      row.getByRole("link", { name: "Otevřít rezervaci", exact: true }),
    ).toHaveAttribute("href", `/admin/reservations?id=${id}`);
    await expect(
      row.getByRole("link", { name: "Profil zákazníka", exact: true }),
    ).toHaveAttribute("href", `/admin/members/${memberId}`);
    await expect(
      row.getByText("recipient_missing", { exact: true }),
    ).not.toBeVisible();
    await row.getByText("Technické podrobnosti", { exact: true }).click();
    await expect(
      row.getByText("recipient_missing", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/gym-incidents-desktop.png",
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await row
      .getByRole("link", { name: "Související zprávy", exact: true })
      .click();
    await expect(
      page.getByText("synthetic_failure_for_lookup", { exact: false }),
    ).toBeVisible();
    await page.goto(`/admin/alerts?q=${id}`);
    await page
      .getByRole("link", { name: "Otevřít rezervaci", exact: true })
      .click();
    await expect(page).toHaveURL(
      new URL(`/admin/reservations?id=${id}`, page.url()).href,
    );
    await expect(page.getByText(prefix, { exact: true })).toBeVisible();
    await page.goto("/admin");
    await expect(page.locator(`a[href="/admin/alerts?q=${id}"]`)).toBeVisible();
    await sql`insert into system_alert(id,title,body,severity,context) values(${legacyId},${`Rezervace ${id}: krok "code_delivered" selhal`},'Po 6 pokusech: Mandatory email delivery failed','critical',${sql.json({ reservationId: id, step: "code_delivered" })})`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/alerts?q=${id}`);
    const mobile = page.locator('[data-incident-list="mobile"]');
    await expect(
      mobile.getByText("Povinný e-mail se nepodařilo odeslat", { exact: true }),
    ).toBeVisible();
    await expect(
      mobile.getByText(/Starší záznam: přesná příčina nebyla zachycena/),
    ).toBeVisible();
    const card = mobile.locator("article").filter({ hasText: prefix });
    expect((await card.boundingBox())!.width).toBeGreaterThan(300);
    await expect(
      card.getByRole("link", { name: "Související zprávy" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: "/tmp/gym-incidents-mobile.png",
      fullPage: true,
    });
    expect(await sql`select * from reservation order by id`).toEqual(before);
    expect(await sql`select * from access_code order by id`).toEqual(codes);
    expect(await sql`select * from message_delivery order by id`).toEqual(
      messages,
    );
    expect(await sql`select * from email_archive order by id`).toEqual(emails);
  } finally {
    await sql`delete from system_alert where id in (${alertId},${legacyId})`;
    await sql`delete from message_delivery where id=${messageId}`;
    await sql`delete from reservation where id=${id}`;
    await sql`delete from profiles where id=${memberId}`;
  }
});
