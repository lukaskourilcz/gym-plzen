import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { join } from "node:path";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { createComgateMock } from "../integration/mocks";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
const localAuth =
  process.env.E2E_LOCAL_AUTH === "true" &&
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://invalid.test")
      .hostname,
  );
if (!localAuth)
  throw new Error(
    "Credit browser tests require the loopback-only Auth fixture.",
  );
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
const gateway = createComgateMock(4547, "CREDIT");
const email = `credit-${process.env.E2E_RUN_ID}@example.test`;
let memberId: string;
const day = addDaysToDateKey(dateKeyInTimeZone(new Date()), 50);
let firstId: string, secondId: string;
let oldReservations: unknown, oldCodes: unknown;
let savedSettings: postgres.Row[] = [],
  savedPeriods: postgres.Row[] = [],
  savedHours: postgres.Row[] = [];
test.describe.configure({ mode: "serial" });
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test.beforeAll(async () => {
  await gateway.start();
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await auth.auth.admin.createUser({
    email,
    password: process.env.E2E_TEST_PASSWORD!,
    email_confirm: true,
    user_metadata: { full_name: "Kredit Test", phone: "+420777000999" },
  });
  if (result.error || !result.data.user)
    throw new Error("Local credit member fixture failed");
  memberId = result.data.user.id;
  await sql`insert into profiles(id,email,full_name,first_name,last_name,phone,role) values(${memberId},${email},'Kredit Test','Kredit','Test','+420777000999','member') on conflict(id) do update set phone=excluded.phone`;
  savedSettings =
    await sql`select * from site_setting where key in ('pricing.entry_price_cents','pricing.time_blocks','features.additional_people','booking.operations')`;
  savedPeriods = await sql`select * from pricing_period`;
  savedHours = await sql`select * from opening_hours`;
  await sql`insert into site_setting(key,value) values('pricing.time_blocks','[]'),('booking.operations','{"paymentsEnabled":true,"accessCodesEnabled":false,"bookingsFrom":""}') on conflict(key) do update set value=excluded.value`;
  await sql`delete from pricing_period`;
  await sql`insert into site_setting(key,value) values('pricing.entry_price_cents','22900') on conflict(key) do update set value=excluded.value`;
  await sql`insert into site_setting(key,value) values('features.additional_people','false') on conflict(key) do update set value=excluded.value`;
  await sql`update opening_hours set open_minute=300,close_minute=1425,slot_minutes=75,is_closed=0`;
  [oldReservations] =
    await sql`select jsonb_agg(to_jsonb(r) order by id) as data from reservation r`;
  [oldCodes] =
    await sql`select jsonb_agg(to_jsonb(c) order by id) as data from access_code c`;
});
test.afterAll(async () => {
  for (const row of savedSettings)
    await sql`update site_setting set value=${sql.json(row.value)},updated_at=${row.updated_at} where key=${row.key}`;
  await sql`delete from pricing_period`;
  if (savedPeriods.length)
    await sql`insert into pricing_period ${sql(savedPeriods)}`;
  for (const row of savedHours)
    await sql`update opening_hours set open_minute=${row.open_minute},close_minute=${row.close_minute},slot_minutes=${row.slot_minutes},is_closed=${row.is_closed},updated_at=${row.updated_at} where id=${row.id}`;
  await gateway.stop();
  await sql.end({ timeout: 2 });
});

test("admin can grant, edit and remove credit with an audit trail", async ({
  page,
}, info) => {
  await page.goto(`/admin/credits?q=${email}`);
  await page
    .getByRole("button", { name: "Spravovat kredity", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Částka v Kč").fill("500");
  await dialog
    .getByLabel("Důvod změny")
    .fill("Testovací kredit v oddělené databázi");
  await dialog.getByRole("button", { name: "Uložit změnu" }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () =>
      Number(
        (
          await sql`select balance_cents from credit_account where user_id=${memberId}`
        )[0]!.balance_cents,
      ),
    )
    .toBe(50000);
  await page
    .getByRole("button", { name: "Spravovat kredity", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Úprava").selectOption("set");
  await dialog.getByLabel("Částka v Kč").fill("550");
  await dialog.getByLabel("Důvod změny").fill("Oprava celkového zůstatku");
  await dialog.getByRole("button", { name: "Uložit změnu" }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () =>
      Number(
        (
          await sql`select balance_cents from credit_account where user_id=${memberId}`
        )[0]!.balance_cents,
      ),
    )
    .toBe(55000);
  await page
    .getByRole("button", { name: "Spravovat kredity", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Úprava").selectOption("remove");
  await dialog.getByLabel("Částka v Kč").fill("50");
  await dialog.getByLabel("Důvod změny").fill("Odebrání nevyužitého kreditu");
  await dialog.getByRole("button", { name: "Uložit změnu" }).click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(async () =>
      Number(
        (
          await sql`select balance_cents from credit_account where user_id=${memberId}`
        )[0]!.balance_cents,
      ),
    )
    .toBe(50000);
  const entries =
    await sql`select amount_cents from credit_entry ce join credit_account ca on ca.id=ce.account_id where ca.user_id=${memberId} order by ce.created_at`;
  expect(entries.map((r) => r.amount_cents)).toEqual([50000, 5000, -5000]);
  await page.getByRole("link", { name: "Kredit Test", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Kreditní peněženka" }),
  ).toContainText("500 Kč");
  await page.goto(`/admin/credits?q=${email}`);
  await page.screenshot({
    path: info.outputPath("credits-admin.png"),
    fullPage: true,
  });
});

test.describe("customer", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("two credit-paid entries can be moved individually, with credit refund and verified cash topup", async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.goto("/login");
    const initialConsent = page
      .getByTestId("tracking-consent")
      .getByRole("button", { name: "Pouze nezbytné" });
    await initialConsent.waitFor({ state: "visible" });
    await initialConsent.click();
    await page.getByLabel("E-mail", { exact: true }).fill(email);
    await page
      .getByLabel("Heslo", { exact: true })
      .fill(process.env.E2E_TEST_PASSWORD!);
    await page
      .getByRole("button", { name: "Přihlásit se", exact: true })
      .click();
    await expect(page).toHaveURL(/\/account/);
    await expect(
      page.getByRole("region", { name: "Kreditní peněženka" }),
    ).toContainText("500 Kč");
    const consent = page
      .getByTestId("tracking-consent")
      .getByRole("button", { name: "Pouze nezbytné" });
    if (await consent.isVisible().catch(() => false)) await consent.click();
    const starts = [600, 675].map((minute) =>
      localDateTimeToDate(day, minute).toISOString(),
    );
    await page.goto(
      `/rezervace/udaje?${new URLSearchParams(starts.map((start) => ["start", start]))}`,
    );
    await page.getByLabel("Jméno", { exact: true }).fill("Kredit");
    await page.getByLabel("Příjmení", { exact: true }).fill("Test");
    await page.getByLabel("Telefon", { exact: true }).fill("+420777000999");
    await expect(
      page.getByRole("checkbox", { name: /Použít dostupné kredity/ }),
    ).toBeChecked();
    await page.getByRole("checkbox", { name: /Souhlasím/ }).check();
    await page.screenshot({
      path: info.outputPath("credits-checkout.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Potvrdit a uhradit kreditem", exact: true })
      .click();
    await expect(page).toHaveURL(/\/rezervace\/hotovo/);
    expect(gateway.creates).toHaveLength(0);
    const bookings =
      await sql`select id,price_cents from reservation where user_id=${memberId} order by starts_at`;
    expect(bookings).toHaveLength(2);
    firstId = String(bookings[0]!.id);
    secondId = String(bookings[1]!.id);
    await sql`update site_setting set value='19900' where key='pricing.entry_price_cents'`;
    const target = addDaysToDateKey(day, 1);
    await page.goto(`/account/rezervace/${firstId}/zmenit?date=${target}`);
    await page
      .getByRole("button", { name: /Vybrat$/ })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /Změnit termín a získat 30/ }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("credits-cheaper-change.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: /Změnit termín a získat 30/ })
      .click();
    await expect(page).toHaveURL(/\/account\?zmena=uspesna/);
    await expect(
      page.getByRole("region", { name: "Kreditní peněženka" }),
    ).toContainText("72 Kč");
    await sql`update site_setting set value='32900' where key='pricing.entry_price_cents'`;
    await page.goto(
      `/account/rezervace/${secondId}/zmenit?date=${addDaysToDateKey(day, 2)}`,
    );
    await page
      .getByRole("button", { name: /Vybrat$/ })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /Zaplatit 28 Kč a změnit termín/ }),
    ).toBeVisible();
    await page.route("https://payments.comgate.cz/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<p>Oddělená testovací platební brána</p>",
      }),
    );
    await page
      .getByRole("button", { name: /Zaplatit 28 Kč a změnit termín/ })
      .click();
    await expect(page).toHaveURL(/payments\.comgate\.cz/);
    expect((gateway.creates[0] as { price: number }).price).toBe(2800);
    const [beforePay] =
      await sql`select starts_at,price_cents from reservation where id=${secondId}`;
    expect(new Date(beforePay!.starts_at).toISOString()).toBe(starts[1]);
    expect(beforePay!.price_cents).toBe(22900);
    const [pending] =
      await sql`select id from reservation_change where reservation_id=${secondId}`;
    gateway.settle("CREDIT-0001", "PAID");
    await page.goto(
      `/account/rezervace/${secondId}/zmenit?change_id=${pending!.id}`,
    );
    await expect(page).toHaveURL(/\/account$/);
    const [wallet] =
      await sql`select balance_cents,reserved_cents from credit_account where user_id=${memberId}`;
    expect(wallet).toMatchObject({ balance_cents: 0, reserved_cents: 0 });
    const [unchanged] =
      await sql`select jsonb_agg(to_jsonb(r) order by id) as data from reservation r where user_id is distinct from ${memberId}`;
    expect(unchanged).toEqual(oldReservations);
    const [codes] =
      await sql`select jsonb_agg(to_jsonb(c) order by id) as data from access_code c`;
    expect(codes).toEqual(oldCodes);
    await page.getByText("Vyúčtování změn termínů", { exact: true }).click();
    const statement = page
      .getByRole("link", { name: /stáhnout vyúčtování/ })
      .first();
    const pdf = await page.request.get((await statement.getAttribute("href"))!);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["cache-control"]).toBe("private, no-store");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const anonymous = await page.context().browser()!.newContext();
    try {
      const deniedStatement = await anonymous.request.get(
        new URL((await statement.getAttribute("href"))!, page.url()).toString(),
      );
      expect(deniedStatement.status()).toBe(404);
    } finally {
      await anonymous.close();
    }

    const denied = await page.request.get("/admin/credits");
    expect(denied.url()).toMatch(/account|login/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/account");
    await page.screenshot({
      path: info.outputPath("credits-customer-mobile.png"),
      fullPage: true,
    });
    const violations = (
      await new AxeBuilder({ page }).include("main").analyze()
    ).violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    );
    expect(violations).toEqual([]);
  });
});
