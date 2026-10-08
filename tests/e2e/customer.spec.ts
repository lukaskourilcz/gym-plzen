import { test, expect } from "@playwright/test";
import { join } from "node:path";
import postgres from "postgres";
import { isTestDatabaseUrl } from "../helpers/test-database";
import { supabaseConfigured } from "./global-setup";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
import { formatDate, formatTimeRange } from "../../src/lib/helpers/format";

const ready =
  supabaseConfigured() && isTestDatabaseUrl(process.env.TEST_DATABASE_URL);
if (!ready && process.env.REQUIRE_DB === "1")
  throw new Error("Customer E2E requires isolated Auth and database fixtures.");
const sql = ready
  ? postgres(process.env.TEST_DATABASE_URL!, { prepare: false, max: 1 })
  : null;
const VOUCHER = "E2ECUSTOMER100";
test.skip(!ready, "requires an explicitly isolated Auth/database environment");
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/member.json") });
test.beforeAll(async () => {
  await sql!`insert into voucher (code, kind, value, is_active) values (${VOUCHER}, 'percentage', 100, true) on conflict do nothing`;
});
test.afterAll(async () => {
  await sql?.end({ timeout: 2 });
});

test("a member cannot read administration pages", async ({ page }) => {
  await page.goto("/admin/members");
  // The login route recognizes the existing member session and returns them
  // to their own account; no admin data may be rendered on the way.
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { name: "Členové" })).toHaveCount(0);
});

test("profile validation, persistence and account ownership work through the form", async ({
  page,
}) => {
  const [adminBefore] =
    await sql!`select id, full_name, phone, notify_by_whatsapp from profiles where email = 'admin@example.test' order by created_at desc limit 1`;
  await page.goto("/account?tab=profile");
  await page.getByLabel("Jméno pro doklady").fill("Lucie");
  await page.getByLabel("Příjmení pro doklady").fill("Testovací");
  await page.getByLabel("Telefonní číslo").fill("neplatný telefon");
  await page
    .getByRole("checkbox", { name: "Také přes WhatsApp", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Uložit profil", exact: true })
    .click();
  await expect(page.getByText("Zadejte platné telefonní číslo.")).toBeVisible();
  await page.getByLabel("Telefonní číslo").fill("+420 777 000 222");
  await page
    .getByRole("button", { name: "Uložit profil", exact: true })
    .click();
  await expect(page.getByText("Profil byl uložen.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Jméno pro doklady")).toHaveValue("Lucie");
  await expect(page.getByLabel("Telefonní číslo")).toHaveValue("+420777000222");
  await expect(
    page.getByRole("checkbox", { name: "Také přes WhatsApp", exact: true }),
  ).toBeChecked();
  const [member] =
    await sql!`select full_name, phone, notify_by_whatsapp from profiles where email = 'member@example.test' order by updated_at desc limit 1`;
  expect(member).toMatchObject({
    full_name: "Lucie Testovací",
    phone: "+420777000222",
    notify_by_whatsapp: true,
  });
  const [adminAfter] =
    await sql!`select id, full_name, phone, notify_by_whatsapp from profiles where id = ${adminBefore!.id}`;
  expect(adminAfter).toEqual(adminBefore);
});

test("a member buys two slots, sees one order, moves one term and cancels only that term", async ({
  page,
}) => {
  test.setTimeout(60_000);
  // Each scenario can run independently of the profile test above.
  await page.goto("/account?tab=profile");
  await page.getByLabel("Jméno pro doklady").fill("Lucie");
  await page.getByLabel("Příjmení pro doklady").fill("Testovací");
  await page.getByLabel("Telefonní číslo").fill("+420777000222");
  await page
    .getByRole("button", { name: "Uložit profil", exact: true })
    .click();
  await expect(page.getByText("Profil byl uložen.")).toBeVisible();
  const day = addDaysToDateKey(dateKeyInTimeZone(new Date()), 14);
  await page.goto(`/rezervace?date=${day}`);
  const slots = page.getByRole("button", { name: /Vybrat$/ });
  expect(await slots.count()).toBeGreaterThan(2);
  await slots.first().click();
  await slots.first().click();
  await page
    .getByRole("region", { name: "Vybrané termíny" })
    .getByRole("link", { name: "Pokračovat", exact: true })
    .click();
  await expect(page.getByTestId("chosen-slot")).toHaveCount(2);
  await expect(page.getByLabel("Jméno", { exact: true })).toHaveValue("Lucie");
  await expect(page.getByLabel("Telefon", { exact: true })).toHaveValue(
    "+420777000222",
  );
  await page.getByLabel("Kód voucheru").fill(VOUCHER);
  await page.getByRole("button", { name: "Použít voucher" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Voucher uplatněn" }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "Souhlasím s provozním řádem a obchodními podmínkami.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Potvrdit vstupy zdarma", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Rezervace jsou potvrzené",
      exact: true,
    }),
  ).toBeVisible();
  const orderId = new URL(page.url()).searchParams.get("order_id")!;
  const booked = await sql!<
    { id: string; status: string; starts_at: Date }[]
  >`select id, status, starts_at from reservation where order_id = ${orderId} order by starts_at`;
  expect(booked).toHaveLength(2);
  expect(booked.map((row) => row.status)).toEqual(["confirmed", "confirmed"]);
  const [payment] =
    await sql!`select count(*)::int as count from payment where order_id = ${orderId}`;
  expect(payment?.count).toBe(0);
  await page.goto("/account?tab=orders");
  await expect(
    page
      .getByRole("heading", { name: "Objednávka 2 termínů", exact: true })
      .first(),
  ).toBeVisible();
  await page.goto("/account");
  await page
    .getByRole("link", { name: "Změnit termín", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/account\/rezervace\/[0-9a-f-]+\/zmenit/);
  const replacements = page
    .locator('section[aria-labelledby="change-time-heading"]')
    .getByRole("button", { name: /Vybrat$/ });
  await expect(replacements.first()).toBeVisible();
  expect(await replacements.count()).toBeGreaterThan(0);
  await replacements.last().click();
  await expect(
    page.getByRole("button", { name: /Potvrdit změnu termínu/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Potvrdit změnu termínu/ }).click();
  await expect(page).toHaveURL(/\/account\?zmena=uspesna/);
  const [moved] = await sql!<
    { starts_at: Date }[]
  >`select starts_at from reservation where id = ${booked[0]!.id}`;
  expect(moved?.starts_at.getTime()).not.toBe(booked[0]!.starts_at.getTime());
  const [changes] =
    await sql!`select count(*)::int as count from reservation_reschedule where reservation_id = ${booked[0]!.id}`;
  expect(changes?.count).toBe(1);
  const [unchanged] = await sql!<
    { starts_at: Date }[]
  >`select starts_at from reservation where id = ${booked[1]!.id}`;
  expect(unchanged?.starts_at.getTime()).toBe(booked[1]!.starts_at.getTime());
  const movedStart = moved!.starts_at;
  const movedEnd = new Date(movedStart.getTime() + 75 * 60_000);
  const cancel = page.getByRole("button", {
    name: `Zrušit rezervaci ${formatDate(movedStart)} ${formatTimeRange(movedStart, movedEnd)}`,
    exact: true,
  });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(
    page.getByText("Zaplacená cena se nevrací.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ponechat rezervaci", exact: true })
    .click();
  const kept = await sql!<
    { status: string }[]
  >`select status from reservation where order_id = ${orderId}`;
  expect(kept.map((row) => row.status)).toEqual(["confirmed", "confirmed"]);
  await cancel.click();
  await page
    .getByRole("button", {
      name: "Ano, zrušit bez vrácení platby",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/storno=hotovo/);
  await expect(
    page.getByText(/Po dokončení odebrání vstupního kódu se termín uvolní/),
  ).toBeVisible();
  const final = await sql!<
    { id: string; status: string }[]
  >`select id, status from reservation where order_id = ${orderId} order by starts_at`;
  expect(
    final.filter((row) => row.status === "cancelled").map((row) => row.id),
  ).toEqual([booked[0]!.id]);
  expect(final.find((row) => row.id === booked[1]!.id)?.status).toBe(
    "confirmed",
  );
});

test("a lost rescheduling response offers account recovery without repeating the change", async ({
  page,
}) => {
  const day = addDaysToDateKey(dateKeyInTimeZone(new Date()), 22);
  const starts = localDateTimeToDate(day, 300);
  const ends = new Date(starts.getTime() + 75 * 60_000);
  const [member] =
    await sql!`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
  const [reservation] =
    await sql!`insert into reservation (user_id, starts_at, ends_at, status, price_cents, contact_email)
    values (${member!.id}, ${starts}, ${ends}, 'confirmed', 22900, 'member@example.test') returning id`;
  const id = reservation!.id;
  try {
    await page.goto(`/account/rezervace/${id}/zmenit?date=${day}`);
    const replacements = page
      .locator('section[aria-labelledby="change-time-heading"]')
      .getByRole("button", { name: /Vybrat$/ });
    await replacements.last().click();
    let posts = 0;
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route(`**/account/rezervace/${id}/zmenit**`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      await route.fetch(); // Commit the change, then lose only its response.
      await route.abort("connectionreset");
    });
    await page.getByRole("button", { name: "Potvrdit změnu termínu" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Rezervace již mohla být přesunuta",
    );
    await expect(
      page.getByRole("button", { name: "Potvrdit změnu termínu" }),
    ).toBeDisabled();
    await page
      .getByRole("link", { name: "Zkontrolovat rezervaci v účtu", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account$/);
    expect(posts).toBe(1);
    expect(errors).toEqual([]);
    const [result] =
      await sql!`select count(*)::int as n from reservation_reschedule where reservation_id=${id}`;
    expect(result?.n).toBe(1);
  } finally {
    await sql!`delete from reservation where id=${id}`;
  }
});
