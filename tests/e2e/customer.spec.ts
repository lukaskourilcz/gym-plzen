import AxeBuilder from "@axe-core/playwright";
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
  await page
    .getByRole("radio", { name: "Přijdu sám / sama", exact: true })
    .check();
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
  // The initial day may have ended when checks run late at night.
  const changeUrl = new URL(page.url());
  changeUrl.searchParams.set(
    "date",
    addDaysToDateKey(dateKeyInTimeZone(new Date()), 2),
  );
  await page.goto(`${changeUrl.pathname}${changeUrl.search}`);
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
    page
      .getByRole("dialog")
      .getByText(/Za tento vstup nebyla uhrazena žádná částka/),
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
      name: "Ano, zrušit rezervaci",
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
    // The completed financial intent must remain immutable. Release this
    // fictional slot without deleting its audit trail from the local fixture.
    await sql!`update reservation set status='cancelled' where id=${id}`;
  }
});

test("reservation cards explain deadlines and cancelled history; opening and dismissing storno never changes business data", async ({
  page,
}) => {
  const [member] =
    await sql!`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
  const start = new Date(Date.now() + 12 * 3_600_000);
  const [r] =
    await sql!`insert into reservation(user_id,starts_at,ends_at,status,price_cents,additional_people_paid_cents,contact_email)
    values(${member!.id},${start},${new Date(start.getTime() + 75 * 60000)},'confirmed',19900,10000,'member@example.test') returning id`;
  const id = r!.id;
  const fingerprint = () => sql!`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as reservations,
    (select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from access_code c) as codes,
    (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by id),'')) from message_delivery m) as messages`;
  try {
    const before = await fingerprint();
    await page.goto("/account");
    const card = page.locator(`[data-reservation-id="${id}"]`);
    await expect(
      card.getByText(
        "Termín lze změnit nejpozději 24 hodin před jeho začátkem.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Změna termínu není dostupná" }),
    ).toBeDisabled();
    const cancel = card.getByRole("button", { name: /Zrušit rezervaci/ });
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await cancel.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/Zaplacených 299.*nevrací/)).toBeVisible();
      await expect(
        dialog.getByText(/Do začátku zbývá méně než 24 hodin/),
      ).toBeVisible();
      await expect(
        dialog.getByRole("link", { name: "Raději změnit termín" }),
      ).toHaveCount(0);
      await expect(
        dialog.getByRole("button", { name: "Ponechat rezervaci" }),
      ).toBeFocused();
      expect(
        (
          await new AxeBuilder({ page })
            .include("dialog")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(cancel).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    expect(await fingerprint()).toEqual(before);
  } finally {
    await sql!`delete from reservation where id=${id}`;
  }
});

test("a lost cancellation response offers history recovery and sends only one confirmation", async ({
  page,
}) => {
  const [member] =
    await sql!`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
  const start = localDateTimeToDate(
    addDaysToDateKey(dateKeyInTimeZone(new Date()), 36),
    300,
  );
  const [r] =
    await sql!`insert into reservation(user_id,starts_at,ends_at,status,price_cents,contact_email,contact_name)
    values(${member!.id},${start},${new Date(start.getTime() + 75 * 60000)},'confirmed',19900,'member@example.test','Jana Ukázková') returning id`;
  const id = r!.id;
  try {
    await page.goto("/account");
    const card = page.locator(`[data-reservation-id="${id}"]`);
    await expect(card.getByText(/Změna termínu do/)).toBeVisible();
    await card.getByRole("button", { name: /Zrušit rezervaci/ }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("link", { name: "Raději změnit termín" }),
    ).toBeVisible();
    let posts = 0;
    await page.route("**/account", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts++;
      await route.fetch();
      await route.abort("connectionreset");
    });
    await page
      .getByRole("button", {
        name: "Ano, zrušit bez vrácení platby",
        exact: true,
      })
      .click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Rezervace už mohla být zrušena",
    );
    await expect(
      page.getByRole("button", {
        name: "Ano, zrušit bez vrácení platby",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("link", { name: "Zkontrolovat rezervaci v účtu", exact: true })
      .click();
    await expect(page).toHaveURL(/view=history/);
    await expect(
      page
        .locator(`[data-reservation-id="${id}"]`)
        .getByText("Zrušeno zákazníkem", { exact: true }),
    ).toBeVisible();
    expect(posts).toBe(1);
    const mails =
      await sql!`select status from message_delivery where dedupe_key=${`cancellation/${id}`}`;
    expect(mails).toHaveLength(1);
    expect(mails[0]!.status).toBe("sent");
  } finally {
    await page.unroute("**/account");
    await sql!`delete from reservation where id=${id}`;
  }
});

test("reservation history is paginated and never includes another member's bookings", async ({
  page,
}) => {
  const [member] =
    await sql!`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
  const [admin] =
    await sql!`select id from profiles where email='admin@example.test' order by created_at desc limit 1`;
  const ids: string[] = [];
  try {
    for (let n = 0; n < 26; n++) {
      const start = localDateTimeToDate(
        addDaysToDateKey(dateKeyInTimeZone(new Date()), 60 + n),
        300,
      );
      const [r] =
        await sql!`insert into reservation(user_id,starts_at,ends_at,status,price_cents,cancel_reason) values(${n === 25 ? admin!.id : member!.id},${start},${new Date(start.getTime() + 75 * 60000)},'cancelled',19900,'Zrušeno zákazníkem (bez vrácení platby)') returning id`;
      ids.push(r!.id);
    }
    await page.goto("/account?view=history");
    await expect(
      page.getByRole("article", { name: /^Rezervace / }),
    ).toHaveCount(20);
    await expect(
      page.locator(`[data-reservation-id="${ids.at(-1)}"]`),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Stránky historie rezervací" })
      .getByRole("link", { name: "Další", exact: true })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(
      page.locator(`[data-reservation-id="${ids[0]}"]`),
    ).toBeVisible();
    await expect(
      page.locator(`[data-reservation-id="${ids.at(-1)}"]`),
    ).toHaveCount(0);
  } finally {
    await sql!`delete from reservation where id in ${sql!(ids)}`;
  }
});

test("rescheduling navigates through lightweight availability, ignores delayed replies, retries outages and keeps the original untouched", async ({
  page,
}) => {
  const [member] =
    await sql!`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
  const date = `${addDaysToDateKey(dateKeyInTimeZone(new Date()), 35).slice(0, 7)}-10`;
  const day2 = addDaysToDateKey(date, 1),
    day3 = addDaysToDateKey(date, 2),
    day4 = addDaysToDateKey(date, 7);
  const start = localDateTimeToDate(date, 300);
  const [r] =
    await sql!`insert into reservation(user_id,starts_at,ends_at,status,price_cents,contact_email)
    values(${member!.id},${start},${new Date(start.getTime() + 75 * 60000)},'confirmed',19900,'member@example.test') returning id`;
  const id = r!.id,
    path = `/account/rezervace/${id}/zmenit`;
  try {
    const before = await sql!`select * from reservation where id=${id}`;
    await page.goto(`${path}?date=${date}`);
    await expect(
      page.getByText(/Původní rezervace platí až do potvrzení změny/),
    ).toBeVisible();
    const navigation: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === path &&
        request.method() === "GET"
      )
        navigation.push(request.url());
    });
    await page.route("**/api/availability/calendar?**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("date") !== day2) return route.continue();
      const response = await route.fetch();
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({ response });
    });
    await page.locator(`a[data-date="${day2}"]`).click();
    await expect(page.locator(`a[data-date="${day2}"]`)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.locator(`a[data-date="${day3}"]`).click();
    await expect(page.locator(`a[data-date="${day3}"]`)).toHaveAttribute(
      "aria-current",
      "true",
    );
    const times = page
      .locator('section[aria-labelledby="change-time-heading"]')
      .getByRole("button", { name: /Vybrat$/ });
    await expect(times.first()).toBeVisible();
    await page.waitForTimeout(350);
    await expect(page.locator(`a[data-date="${day3}"]`)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.unrouteAll({ behavior: "wait" });
    await page.route("**/api/availability/calendar?**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"unavailable"}',
      }),
    );
    await page.locator(`a[data-date="${day4}"]`).click();
    await expect(
      page.getByText("Kalendář se nepodařilo načíst", { exact: true }),
    ).toBeVisible();
    await expect(times).toHaveCount(0);
    await page.unrouteAll({ behavior: "wait" });
    await page
      .getByRole("button", { name: "Zkusit znovu", exact: true })
      .click();
    await expect(times.first()).toBeVisible();
    await page.goBack();
    await expect(page.locator(`a[data-date="${day3}"]`)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(times.first()).toBeVisible();
    await times.first().click();
    await expect(
      page.getByText("Potvrzení změny", { exact: true }),
    ).toBeVisible();
    await page.evaluate(() =>
      window.dispatchEvent(new Event("navi:calendar-availability-change")),
    );
    await expect(times.first()).toBeVisible();
    expect(navigation).toEqual([]);
    expect(await sql!`select * from reservation where id=${id}`).toEqual(
      before,
    );
    expect(
      await sql!`select * from reservation_reschedule where reservation_id=${id}`,
    ).toHaveLength(0);
    expect(
      await sql!`select * from message_delivery where reservation_id=${id}`,
    ).toHaveLength(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await sql!`delete from reservation where id=${id}`;
  }
});

test("email emphasis previews and persists without touching reservations, codes or messages", async ({
  browser,
}) => {
  const key = "messages.email.access_code";
  const [saved] = await sql!`select * from site_setting where key=${key}`;
  const state = () => sql!`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as reservations,
    (select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from access_code c) as codes,
    (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by id),'')) from message_delivery m) as messages,
    (select md5(coalesce(string_agg(to_jsonb(e)::text,'' order by id),'')) from email_archive e) as emails`;
  const before = await state();
  const context = await browser.newContext({
    storageState: join(process.cwd(), "tests/e2e/.auth/admin.json"),
  });
  const page = await context.newPage();
  try {
    await page.goto("/admin/emails");
    await page.getByRole("tab", { name: "Vstupní kód", exact: true }).click();
    const body = page.getByLabel("Text e-mailu", { exact: true });
    await expect(body).toHaveValue(/Vstupní kód: \{code\}/);
    const multiLine = "Klidnější cvičení.\nHudbu pouze do sluchátek.";
    await body.fill(multiLine);
    await body.evaluate((element) => {
      const input = element as HTMLTextAreaElement;
      input.focus();
      input.select();
    });
    await page.getByRole("button", { name: "Tučně", exact: true }).click();
    await expect(body).toHaveValue(
      "**Klidnější cvičení.**\n**Hudbu pouze do sluchátek.**",
    );
    await page.getByRole("button", { name: "Tučně", exact: true }).click();
    await expect(body).toHaveValue(multiLine);
    const source =
      "Ahoj {name},\n\nPravidla: hudbu pouze do sluchátek.\n\nKód: {code}\nČas: {time}";
    await body.fill(source);
    const phrase = "hudbu pouze do sluchátek";
    await body.evaluate((element, phrase) => {
      const input = element as HTMLTextAreaElement;
      input.focus();
      const start = input.value.indexOf(phrase);
      input.setSelectionRange(start, start + phrase.length);
    }, phrase);
    await page.getByRole("button", { name: "Tučně", exact: true }).click();
    await expect(body).toHaveValue(source.replace(phrase, `**${phrase}**`));
    await expect(
      page.locator("strong").filter({ hasText: phrase }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Tučně", exact: true }).click();
    await expect(body).toHaveValue(source);
    await expect(
      page.locator("strong").filter({ hasText: phrase }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Tučně", exact: true }).click();
    await page
      .getByRole("button", { name: "Uložit šablonu", exact: true })
      .click();
    await expect(
      page.getByText(
        "Šablona uložená. Další odpovídající e-mail použije nový text.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "Vstupní kód", exact: true }).click();
    await expect(body).toHaveValue(source.replace(phrase, `**${phrase}**`));
    await expect(
      page.locator("strong").filter({ hasText: phrase }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(await state()).toEqual(before);
  } finally {
    if (saved)
      await sql!`update site_setting set value=${sql!.json(saved.value)},updated_at=${saved.updated_at},updated_by_admin_id=${saved.updated_by_admin_id} where key=${key}`;
    else await sql!`delete from site_setting where key=${key}`;
    await context.close();
  }
});

test("administrator can edit the new customer cancellation template and preview the no-refund text without sending messages", async ({
  browser,
}) => {
  const key = "messages.email.customer_reservation_cancellation";
  const [saved] = await sql!`select * from site_setting where key=${key}`;
  const state = () => sql!`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as reservations,
    (select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from access_code c) as codes,
    (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by id),'')) from message_delivery m) as messages,
    (select md5(coalesce(string_agg(to_jsonb(e)::text,'' order by id),'')) from email_archive e) as emails`;
  const before = await state();
  const context = await browser.newContext({
    storageState: join(process.cwd(), "tests/e2e/.auth/admin.json"),
  });
  const page = await context.newPage();
  try {
    await page.goto("/admin/emails");
    await page
      .getByRole("tab", { name: "Zrušení rezervace zákazníkem", exact: true })
      .click();
    await expect(page.getByLabel("Text e-mailu", { exact: true })).toHaveValue(
      /\{refund_note\}/,
    );
    await expect(
      page.getByText(
        "Zaplacených 229 Kč se podle obchodních podmínek nevrací.",
        { exact: true },
      ),
    ).toBeVisible();
    const subject = page.getByLabel("Předmět", { exact: true });
    await subject.fill("Potvrzení zákaznického storna");
    await page
      .getByRole("button", { name: "Uložit šablonu", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await sql!`select value from site_setting where key=${key}`)[0]
            ?.value?.subject,
      )
      .toContain("Potvrzení zákaznického storna");
    await page.reload();
    await page
      .getByRole("tab", { name: "Zrušení rezervace zákazníkem", exact: true })
      .click();
    await expect(subject).toHaveValue(/Potvrzení zákaznického storna/);
    expect(await state()).toEqual(before);
  } finally {
    if (saved)
      await sql!`update site_setting set value=${sql!.json(saved.value)},updated_at=${saved.updated_at},updated_by_admin_id=${saved.updated_by_admin_id} where key=${key}`;
    else await sql!`delete from site_setting where key=${key}`;
    await context.close();
  }
});
