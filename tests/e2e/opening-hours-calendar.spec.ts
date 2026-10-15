import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  daysBetweenDateKeys,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => sql.end({ timeout: 2 }));
test.use({
  storageState: join(process.cwd(), "tests/e2e/.auth/admin.json"),
  timezoneId: "Europe/Prague",
  hasTouch: true,
});
async function reveal(locator: Locator) {
  await locator.evaluate(async (element) => {
    element.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "instant",
    });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

test("changed hours preserve reservations and codes while all calendar views show grey out-of-hours bookings", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const originalHours =
    await sql`select * from opening_hours order by day_of_week`;
  const today = dateKeyInTimeZone(new Date());
  let saturday = addDaysToDateKey(today, 28);
  while (dayOfWeek(localDateTimeToDate(saturday, 720)) !== 6)
    saturday = addDaysToDateKey(saturday, 1);
  const sunday = addDaysToDateKey(saturday, 1);
  const memberId = randomUUID();
  const ids: string[] = [];
  try {
    await sql`update opening_hours set open_minute=300,close_minute=1320,slot_minutes=75,is_closed=0`;
    await sql`update opening_hours set open_minute=240,close_minute=1425 where day_of_week=6`;
    await sql`insert into profiles(id,email,full_name,note) values (${memberId},'hours-browser@example.test','Rozvrh: časný host','Soukromá poznámka zůstává dostupná.')`;
    for (const [day, start, end, name] of [
      [saturday, 240, 315, "Rozvrh: časný host"],
      [saturday, 615, 690, "Rozvrh: běžný host"],
      [saturday, 1275, 1350, "Rozvrh: pozdní host"],
      [sunday, 720, 795, "Rozvrh: zavřený den"],
    ] as const) {
      const [row] =
        await sql`insert into reservation(user_id,starts_at,ends_at,status,price_cents,contact_name,contact_email)
        values (${name === "Rozvrh: časný host" ? memberId : null},${localDateTimeToDate(day, start)},${localDateTimeToDate(day, end)},'confirmed',23900,${name},'hours-browser@example.test') returning id`;
      ids.push(row!.id);
    }
    const before = await sql`select * from reservation order by id`;
    const codesBefore = await sql`select * from access_code order by id`;
    const [emailsBefore] =
      await sql`select count(*)::int as n from email_archive`;
    await page.goto("/admin/schedule");
    const saturdayForm = page
      .locator("form")
      .filter({ has: page.locator("#open-6") });
    await saturdayForm.getByLabel("Otevřeno", { exact: true }).fill("06:00");
    await saturdayForm.locator("#close-6").fill("22:00");
    await saturdayForm
      .getByRole("button", { name: "Uložit", exact: true })
      .click();
    await expect(saturdayForm.getByRole("status")).toHaveText("Uloženo.");
    const sundayForm = page
      .locator("form")
      .filter({ has: page.locator("#open-0") });
    await sundayForm
      .getByRole("checkbox", { name: "Zavřeno", exact: true })
      .check();
    await sundayForm
      .getByRole("button", { name: "Uložit", exact: true })
      .click();
    await expect(sundayForm.getByRole("status")).toHaveText("Uloženo.");
    expect(await sql`select * from reservation order by id`).toEqual(before);
    expect(await sql`select * from access_code order by id`).toEqual(
      codesBefore,
    );
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emailsBefore!.n);

    await page.goto("/admin/calendar");
    const monday = addDaysToDateKey(today, -((dayOfWeek(new Date()) + 6) % 7));
    const weeks =
      daysBetweenDateKeys(monday, addDaysToDateKey(saturday, -5)) / 7;
    for (let n = 0; n < weeks; n++)
      await page
        .getByRole("button", { name: "Další období", exact: true })
        .click();
    const early = page.getByRole("button", {
      name: "Rozvrh: časný host",
      exact: true,
    });
    const late = page.getByRole("button", {
      name: "Rozvrh: pozdní host",
      exact: true,
    });
    const closed = page.getByRole("button", {
      name: "Rozvrh: zavřený den",
      exact: true,
    });
    for (const trigger of [early, late, closed])
      await expect(trigger).toHaveCount(1);
    await expect(
      page
        .locator(".fc-timegrid-slot-label")
        .getByText("04:00 – 04:15", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".fc-timegrid-slot-label")
        .getByText("22:15 – 22:30", { exact: true }),
    ).toBeVisible();
    const grey = await page
      .locator('[aria-label="Legenda kalendáře"] .bg-muted-foreground')
      .last()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    for (const name of [
      "Rozvrh: časný host",
      "Rozvrh: pozdní host",
      "Rozvrh: zavřený den",
    ]) {
      await expect(
        page.locator(".fc-event").filter({ hasText: name }),
      ).toHaveCSS("background-color", grey);
    }
    await expect(
      page.locator(".fc-event").filter({ hasText: "Rozvrh: běžný host" }),
    ).not.toHaveCSS("background-color", grey);
    await reveal(early);
    await early.focus();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Rezervace mimo otevírací dobu",
    );
    await page.keyboard.press("Escape");
    const note = page.getByRole("button", {
      name: "Poznámka k zákazníkovi Rozvrh: časný host",
      exact: true,
    });
    await page.keyboard.press("Tab");
    await expect(note).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Soukromá poznámka zůstává dostupná.",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Den", exact: true }).click();
    for (let n = 0; n < 7 && (await early.count()) === 0; n++)
      await page
        .getByRole("button", { name: "Další období", exact: true })
        .click();
    await expect(early).toHaveCount(1);
    await expect(late).toHaveCount(1);
    await page.getByRole("button", { name: "Měsíc", exact: true }).click();
    await expect(early).toHaveCount(1);
    await expect(late).toHaveCount(1);
    await expect(
      page.locator(".fc-event").filter({ hasText: "Rozvrh: časný host" }),
    ).toHaveCSS("background-color", grey);
    await page.setViewportSize({ width: 390, height: 844 });
    await reveal(early);
    await early.tap();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Rezervace mimo otevírací dobu",
    );
    const tooltip = await page
      .locator('[role="tooltip"]')
      .evaluate((element) => ({
        left: element.getBoundingClientRect().left,
        right: element.getBoundingClientRect().right,
        width: window.innerWidth,
      }));
    expect(tooltip.left).toBeGreaterThanOrEqual(0);
    expect(tooltip.right).toBeLessThanOrEqual(tooltip.width);
    await page.keyboard.press("Escape");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Týden", exact: true }).click();
    await page.screenshot({
      path: "/tmp/gym-hours-calendar.png",
      fullPage: true,
    });
    expect(await sql`select * from reservation order by id`).toEqual(before);
    expect(await sql`select * from access_code order by id`).toEqual(
      codesBefore,
    );
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emailsBefore!.n);
  } finally {
    if (ids.length) await sql`delete from reservation where id in ${sql(ids)}`;
    await sql`delete from profiles where id=${memberId}`;
    for (const h of originalHours)
      await sql`update opening_hours set open_minute=${h.open_minute},close_minute=${h.close_minute},slot_minutes=${h.slot_minutes},is_closed=${h.is_closed},updated_at=${h.updated_at} where day_of_week=${h.day_of_week}`;
  }
});
