import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { createComgateMock } from "../integration/mocks";
import { isTestDatabaseUrl } from "../helpers/test-database";

/**
 * The public booking flow in a browser against a production build with a
 * local Postgres and a local stand-in for the payment gateway (mode 5 in the
 * README). Covers the two paths a visitor actually takes: a voucher that
 * covers the whole price, and a paid booking where the visitor comes back
 * from the gateway and submits again, which on 17. 9. 2026 reported the
 * visitor's own hold as a taken slot.
 *
 * Start the server with the gateway pointed at this file's stand-in:
 *
 *   COMGATE_API_URL=http://127.0.0.1:4547/v2.0 COMGATE_MERCHANT_ID=test \
 *   COMGATE_SECRET=test COMGATE_TEST_MODE=true PORT=3131 npm start
 */
const DATABASE_URL = process.env.TEST_DATABASE_URL;
const ready = isTestDatabaseUrl(DATABASE_URL);
if (!ready && process.env.REQUIRE_DB === "1")
  throw new Error(
    "Booking E2E requires an explicit, dedicated local TEST_DATABASE_URL.",
  );
const GATEWAY_PORT = Number(process.env.E2E_COMGATE_PORT ?? 4547);
const VOUCHER = "E2EFREE100";

const gateway = createComgateMock(GATEWAY_PORT);
const sql = ready ? postgres(DATABASE_URL!, { prepare: false, max: 1 }) : null;

test.describe("Booking flow", () => {
  test.skip(!ready, "needs a local DATABASE_URL (see tests/e2e/README.md)");
  test.beforeAll(async () => {
    await gateway.start();
    // The stand-in numbers its payments from one on every start, so a payment
    // row left by an earlier run would collide on the provider id.
    await sql!`delete from payment where provider = 'comgate' and provider_payment_id like 'TEST-%'`;
    await sql!`insert into site_setting (key, value, updated_at)
      values ('booking.operations', ${sql!.json({ paymentsEnabled: true, bookingsFrom: "", accessCodesEnabled: false })}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
    await sql!`insert into voucher (code, kind, value, is_active) values (${VOUCHER}, 'percentage', 100, true)
      on conflict do nothing`;
  });
  test.afterAll(async () => {
    await gateway.stop();
    await sql?.end({ timeout: 2 });
  });
  test.beforeEach(async () => {
    await sql!`delete from reservation where contact_email like 'e2e-%@example.test'`;
    await sql!`delete from booking_order where contact_email like 'e2e-%@example.test'`;
  });

  async function openFirstFreeSlot(page: Page): Promise<string> {
    await page.goto("/rezervace", { waitUntil: "domcontentloaded" });
    const consent = page
      .getByTestId("tracking-consent")
      .getByRole("button", { name: "Pouze nezbytné" });
    if (await consent.isVisible().catch(() => false)) await consent.click();
    // A slot is a toggle; the selection bar leads on to the details step.
    const slots = page.getByRole("button", { name: /Vybrat$/ });
    // A day is preselected; pick the last slot of that day so the two
    // scenarios never compete for the same time.
    const count = await slots.count();
    expect(count, "the calendar offers bookable slots").toBeGreaterThan(1);
    await slots.nth(count - 1).click();
    await page
      .getByRole("region", { name: "Vybrané termíny" })
      .getByRole("link", { name: /Pokračovat/ })
      .click();
    await expect(page).toHaveURL(/\/rezervace\/udaje\?start=/);
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  }

  async function fillDetails(page: Page, email: string) {
    await page.getByLabel("Jméno", { exact: true }).fill("Eva");
    await page.getByLabel("Příjmení").fill("Testová");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Telefon").fill("+420 777 123 456");
    await page.locator("form").getByRole("checkbox").check();
  }

  test("a voucher covering the whole price confirms the entry without a payment", async ({
    page,
  }) => {
    await openFirstFreeSlot(page);
    await fillDetails(page, "e2e-voucher@example.test");
    await page.getByLabel("Kód voucheru").fill(VOUCHER);
    await page.getByRole("button", { name: "Použít voucher" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Voucher uplatněn" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Potvrdit vstup zdarma/ }),
    ).toBeEnabled();
    await page.getByRole("button", { name: /Potvrdit vstup zdarma/ }).click();

    // The proof token is consumed by the server and intentionally removed
    // from the visible URL before analytics can read it. Its presence in the
    // address bar is transient and varies with browser/server speed.
    await expect(page).toHaveURL(/\/rezervace\/hotovo\?order_id=/);
    await expect(
      page.getByRole("heading", { name: "Rezervace je potvrzená" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Přidat do Google Kalendáře/ }),
    ).toBeVisible();

    const [row] = await sql!<{ status: string; price_cents: number }[]>`
      select status, price_cents from reservation where contact_email = 'e2e-voucher@example.test'`;
    expect(row?.status).toBe("confirmed");
    expect(row?.price_cents).toBe(0);
    await expect
      .poll(() => new URL(page.url()).searchParams.has("token"))
      .toBe(false);
    const unproved = await page.context().browser()!.newContext();
    try {
      const copiedLink = await unproved.newPage();
      await copiedLink.goto(page.url());
      await expect(
        copiedLink.getByRole("heading", {
          name: "Potvrzení se nepodařilo ověřit",
        }),
      ).toBeVisible();
    } finally {
      await unproved.close();
    }
  });

  test("coming back from the gateway continues the visitor's own booking", async ({
    page,
  }) => {
    // The gateway itself is out of scope: any navigation there is answered
    // locally and the id of the payment session is what the test compares.
    const visited: string[] = [];
    await page.route("https://payments.comgate.cz/**", (route) => {
      visited.push(route.request().url());
      void route.fulfill({
        contentType: "text/html",
        body: "<h1>Platební brána (stand-in)</h1>",
      });
    });

    const detailsHref = await openFirstFreeSlot(page);
    await fillDetails(page, "e2e-checkout@example.test");
    await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
    await page.waitForURL("https://payments.comgate.cz/**");
    expect(visited).toHaveLength(1);
    expect(gateway.creates).toHaveLength(1);

    // Back to the details step: the slot is held by this very visitor, so the
    // page says so instead of bouncing to an "occupied" notice.
    await page.goto(detailsHref, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/rezervace\/udaje\?start=/);
    await expect(
      page.getByText("Tento termín už pro vás držíme"),
    ).toBeVisible();
    await fillDetails(page, "e2e-checkout@example.test");
    await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
    await page.waitForURL("https://payments.comgate.cz/**");

    // Same payment session, one reservation, one attempt at the gateway.
    expect(visited).toHaveLength(2);
    expect(visited[1]).toBe(visited[0]);
    expect(gateway.creates).toHaveLength(1);
    const held = await sql!<{ status: string }[]>`
      select status from reservation where contact_email = 'e2e-checkout@example.test'`;
    expect(held.map((r) => r.status)).toEqual(["pending"]);

    // Anyone else still finds the slot taken.
    const other = await page.context().browser()!.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto(detailsHref, { waitUntil: "domcontentloaded" });
    await expect(otherPage).toHaveURL(/\/rezervace\?date=.*&stav=obsazeno/);
    await other.close();
  });
});
