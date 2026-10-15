import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => sql.end({ timeout: 2 }));
test.use({
  storageState: join(process.cwd(), "tests/e2e/.auth/admin.json"),
  // Keep the desktop sidebar while forcing horizontal table overflow locally
  // as well as on Linux, where different font metrics make the table wider.
  viewport: { width: 1100, height: 720 },
});

test("private member notes save, annotate names and clear without changing bookings or sending messages", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const [member] =
    await sql`select * from profiles where email='member@example.test' order by created_at desc limit 1`;
  const name = String(member!.full_name);
  const reservationName = "Poznámkový zákazník";
  const originalNote = member!.note;
  await sql`update profiles set note=null where id=${member!.id}`;
  const day = addDaysToDateKey(dateKeyInTimeZone(new Date()), 1);
  const ids: string[] = [];
  for (const [minute, userId] of [
    [1200, member!.id],
    [1275, null],
  ] as const) {
    const start = localDateTimeToDate(day, minute);
    const [row] =
      await sql`insert into reservation (user_id,starts_at,ends_at,status,price_cents,contact_name,contact_email) values (${userId},${start},${new Date(start.getTime() + 75 * 60000)},'confirmed',22900,${reservationName},'note-browser@example.test') returning id`;
    ids.push(row!.id);
  }
  const reservationsBefore = await sql`select * from reservation order by id`;
  const paymentsBefore = await sql`select * from payment order by id`;
  const [emails] = await sql`select count(*)::int as n from email_archive`;
  const note = "Domluvit rozcvičení.\n<b>Bez HTML formátování.</b>";
  try {
    await page.goto(`/admin/members?q=${encodeURIComponent(member!.email)}`);
    await page.bringToFront();
    const row = page
      .getByRole("row")
      .filter({ has: page.locator(`a[href='/admin/members/${member!.id}']`) });
    await row
      .getByRole("button", { name: "Přidat poznámku", exact: true })
      .click();
    const editor = page.getByRole("dialog", {
      name: "Přidat poznámku",
      exact: true,
    });
    await expect(editor.getByLabel("Poznámka", { exact: true })).toBeFocused();
    await editor.getByLabel("Poznámka", { exact: true }).fill(note);
    const submitted = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        Boolean(request.headers()["next-action"]),
    );
    const refreshed = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        response.request().method() === "GET" &&
        url.pathname === "/admin/members" &&
        url.searchParams.has("_rsc") &&
        response.request().headers()["next-router-prefetch"] !== "1"
      );
    });
    await editor
      .getByRole("button", { name: "Uložit poznámku", exact: true })
      .click();
    const action = await submitted;
    await refreshed;
    await expect(editor).not.toBeVisible();
    await expect(
      row.getByRole("button", { name: "Upravit poznámku", exact: true }),
    ).toBeVisible();
    const tableRegion = page.getByRole("region", { name: "Tabulka" });
    await expect
      .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    // Move away from the removed dialog before testing keyboard interaction;
    // its former pointer position can now hover a newly rendered note icon.
    await page.mouse.move(0, 0);
    const indicator = row.getByRole("button", {
      name: `Poznámka k zákazníkovi ${name}`,
      exact: true,
    });
    await expect(indicator).toBeVisible();
    // Saving from the last column scrolls a wide table to the right. Restore
    // the whole name first: focusing a clipped link otherwise scrolls again
    // after Tab has opened the tooltip, which Radix dismisses on scroll.
    const nameLink = row.getByRole("link", { name, exact: true });
    await nameLink.scrollIntoViewIfNeeded();
    await expect(nameLink).toBeInViewport({ ratio: 1 });
    await expect
      .poll(() => tableRegion.evaluate((element) => element.scrollLeft))
      .toBe(0);
    await nameLink.focus();
    await page.keyboard.press("Tab");
    await expect(indicator).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText(note);
    await expect(page.getByRole("tooltip").locator("b")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("tooltip")).not.toBeVisible();
    const saved = (
      await sql`select * from profiles where id=${member!.id}`
    )[0]!;
    for (const field of Object.keys(member!).filter(
      (field) => !["note", "updated_at"].includes(field),
    ))
      expect(saved[field]).toEqual(member![field]);
    expect(saved.note).toBe(note);

    // Replaying the real action with another session must not grant write access.
    const payload = JSON.parse(action.postData()!);
    payload[0].note = "Nepovolená změna";
    for (const storageState of [
      join(process.cwd(), "tests/e2e/.auth/member.json"),
      undefined,
    ]) {
      const context = await browser.newContext({ storageState });
      try {
        await context.request.post(action.url(), {
          headers: {
            "next-action": action.headers()["next-action"]!,
            "content-type": "text/plain;charset=UTF-8",
            origin: new URL(action.url()).origin,
          },
          data: JSON.stringify(payload),
        });
        expect(
          (await sql`select note from profiles where id=${member!.id}`)[0]!
            .note,
        ).toBe(note);
        if (storageState) {
          const customer = await context.newPage();
          const response = await customer.goto("/account");
          expect(await response!.text()).not.toContain("Domluvit rozcvičení.");
          await expect(customer.locator("body")).not.toContainText(
            "Domluvit rozcvičení.",
          );
        }
      } finally {
        await context.close();
      }
    }

    await page.goto("/admin/calendar");
    await page.bringToFront();
    await page.mouse.move(0, 0);
    await expect(
      page.getByRole("button", {
        name: `Poznámka k zákazníkovi ${reservationName}`,
        exact: true,
      }),
    ).toHaveCount(1);
    const calendarIndicator = page.getByRole("button", {
      name: `Poznámka k zákazníkovi ${reservationName}`,
      exact: true,
    });
    await calendarIndicator.scrollIntoViewIfNeeded();
    await calendarIndicator.focus();
    await expect(calendarIndicator).toBeFocused();
    await expect(page.getByRole("tooltip")).toHaveText(note);
    await page.keyboard.press("Escape");
    await page.goto(`/admin/reservations?id=${ids[0]}`);
    await expect(
      page.getByRole("button", {
        name: `Poznámka k zákazníkovi ${reservationName}`,
        exact: true,
      }),
    ).toBeVisible();
    await page.goto(`/admin/members/${member!.id}`);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileIndicator = page
      .getByRole("button", { name: /Poznámka k zákazníkovi/ })
      .first();
    await mobileIndicator.click();
    await expect(page.getByRole("tooltip")).toHaveText(note);
    const bounds = await page
      .locator(".admin-note-tooltip")
      .evaluate((element) => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, width: window.innerWidth };
      });
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Upravit poznámku", exact: true })
      .click();
    const edit = page.getByRole("dialog", {
      name: "Upravit poznámku",
      exact: true,
    });
    await expect(edit.getByLabel("Poznámka", { exact: true })).toHaveValue(
      note,
    );
    await edit.getByLabel("Poznámka", { exact: true }).fill("");
    await edit
      .getByRole("button", { name: "Uložit poznámku", exact: true })
      .click();
    await expect(edit).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /Poznámka k zákazníkovi/ }),
    ).toHaveCount(0);
    expect(
      (await sql`select note from profiles where id=${member!.id}`)[0]!.note,
    ).toBeNull();
    expect(await sql`select * from reservation order by id`).toEqual(
      reservationsBefore,
    );
    expect(await sql`select * from payment order by id`).toEqual(
      paymentsBefore,
    );
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emails!.n);
  } finally {
    await sql`delete from reservation where id in ${sql(ids)}`;
    await sql`update profiles set note=${originalNote} where id=${member!.id}`;
  }
});
