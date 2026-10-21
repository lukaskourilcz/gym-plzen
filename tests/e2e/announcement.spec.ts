import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { ANNOUNCEMENT_SETTING_KEY as key } from "../../src/lib/config/opening";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });

test("one banner supports both lines, one bold line, hiding and restoration without touching bookings or deliveries", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  const [previous] = await sql`select * from site_setting where key=${key}`;
  const others =
    await sql`select key,md5(to_jsonb(s)::text) as hash from site_setting s where key<>${key} order by key`;
  const legacy =
    await sql`select * from content_block where key like 'home.opening.%' order by key`;
  const bookingId = randomUUID();
  const [admin] =
    await sql`select id from profiles where email='admin@example.test'`;
  await sql`insert into reservation(id,user_id,starts_at,ends_at,status,price_cents,contact_email) values(${bookingId},${admin!.id},now()+interval '10 days',now()+interval '10 days 75 minutes','confirmed',19900,'untouched@example.test')`;
  await sql`insert into access_code(reservation_id,code_hash,code_last2,valid_from,valid_until,status) values(${bookingId},'synthetic-hash','42',now()+interval '10 days',now()+interval '10 days 75 minutes','active')`;
  const state = () => sql`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as bookings,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from access_code r) as codes,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from message_delivery r) as messages,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from email_archive r) as emails,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from payment r) as payments`;
  const before = await state();
  const publicPage = await page.context().newPage();
  const banner = publicPage.getByRole("complementary", {
    name: "Otevření a akční vstupné",
  });
  const enabled = page.getByRole("switch", {
    name: "Ukazovat oznamovací lištu",
    exact: true,
  });
  const second = page.getByRole("switch", {
    name: "Ukazovat druhý řádek",
    exact: true,
  });
  async function edit(label: string, text: string) {
    await page
      .getByRole("button", { name: `Upravit: ${label}`, exact: true })
      .click();
    await page
      .getByRole("textbox", { name: `Text: ${label}`, exact: true })
      .fill(text);
    await page
      .getByRole("button", { name: "Uložit změny", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  try {
    await page.goto("/admin/content?section=opening");
    await edit("Hlavní text lišty", "Oznámení na přání klienta");
    if (!(await enabled.isChecked())) {
      await enabled.click();
      await expect(enabled).toBeChecked();
    }
    if (!(await second.isChecked())) {
      await second.click();
      await expect(second).toBeChecked();
    }
    await edit("Druhý řádek", "Volitelný doplňující text");
    await publicPage.goto("/");
    await expect(banner.getByRole("link")).toHaveText(
      "Oznámení na přání klienta",
    );
    await expect(banner.locator("p")).toHaveText("Volitelný doplňující text");
    // The same registered action must reject a customer session.
    const actionPromise = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"],
    );
    await second.click();
    const action = await actionPromise;
    await expect(second).not.toBeChecked();
    const [saved] = await sql`select * from site_setting where key=${key}`;
    const member = await browser.newContext({
      storageState: join(process.cwd(), "tests/e2e/.auth/member.json"),
    });
    try {
      const response = await member.request.post(action.url(), {
        data: action.postData()!,
        headers: {
          "content-type": action.headers()["content-type"]!,
          "next-action": action.headers()["next-action"]!,
          origin: new URL(action.url()).origin,
        },
      });
      expect(await response.text()).toContain("Nemáte oprávnění k této akci.");
      expect(await sql`select * from site_setting where key=${key}`).toEqual([
        saved,
      ]);
    } finally {
      await member.close();
    }
    await publicPage.reload();
    await expect(banner).toBeVisible();
    await expect(banner.locator("p")).toHaveCount(0);
    expect(
      await banner
        .getByRole("link")
        .evaluate((el) => getComputedStyle(el).fontWeight),
    ).toBe("800");
    await enabled.click();
    await expect(enabled).not.toBeChecked();
    await publicPage.reload();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(enabled).not.toBeChecked();
    await expect(
      page.getByText("Oznámení na přání klienta", { exact: true }),
    ).toBeVisible();
    await enabled.focus();
    await page.keyboard.press("Space");
    await expect(enabled).toBeChecked();
    await second.click();
    await expect(second).toBeChecked();
    await publicPage.reload();
    await expect(banner.locator("p")).toHaveText("Volitelný doplňující text");
    await edit("Druhý řádek", "");
    await publicPage.reload();
    await expect(banner.locator("p")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Upravit: Hlavní text lišty", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Text: Hlavní text lišty" })
      .fill(" ");
    await page
      .getByRole("button", { name: "Uložit změny", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Zadejte hlavní text lišty.",
    );
    await page.keyboard.press("Escape");
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    const a11y = await new AxeBuilder({ page })
      .include("main")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(await state()).toEqual(before);
    expect(
      await sql`select key,md5(to_jsonb(s)::text) as hash from site_setting s where key<>${key} order by key`,
    ).toEqual(others);
    expect(
      await sql`select * from content_block where key like 'home.opening.%' order by key`,
    ).toEqual(legacy);
  } finally {
    // Restore the isolated fixture and invalidate its public cache through the
    // real admin action, never by touching a production setting.
    await page.goto("/admin/content?section=opening");
    await edit(
      "Hlavní text lišty",
      previous?.value?.title ?? "MÁME OTEVŘENO • VSTUP 199 Kč PO CELÝ ŘÍJEN",
    );
    if (previous)
      await sql`update site_setting set value=${sql.json(previous.value)},updated_at=${previous.updated_at},updated_by_admin_id=${previous.updated_by_admin_id} where key=${key}`;
    else await sql`delete from site_setting where key=${key}`;
    await sql`delete from access_code where reservation_id=${bookingId}`;
    await sql`delete from reservation where id=${bookingId}`;
    await publicPage.close();
  }
});

test("unconfirmed save keeps the draft, blocks further writes and offers state verification", async ({
  page,
}) => {
  await page.goto("/admin/content?section=opening");
  const before = await sql`select * from site_setting where key=${key}`;
  await page
    .getByRole("button", { name: "Upravit: Hlavní text lišty", exact: true })
    .click();
  const field = page.getByRole("textbox", { name: "Text: Hlavní text lišty" });
  await field.fill("Rozepsaný text při výpadku");
  await page.route("**/admin/content**", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Uložit změny", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Uložení se nepodařilo potvrdit",
  );
  await expect(field).toHaveValue("Rozepsaný text při výpadku");
  await expect(
    page.getByRole("button", { name: "Uložit změny", exact: true }),
  ).toBeDisabled();
  expect(await sql`select * from site_setting where key=${key}`).toEqual(
    before,
  );
  await page.unroute("**/admin/content**");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Obnovit a ověřit stav" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("switch", {
      name: "Ukazovat oznamovací lištu",
      exact: true,
    }),
  ).toBeEnabled();
});
