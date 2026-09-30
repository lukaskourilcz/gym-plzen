import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { isTestDatabaseUrl } from "../helpers/test-database";

const isolated =
  process.env.E2E_LOCAL_AUTH === "true" &&
  isTestDatabaseUrl(process.env.TEST_DATABASE_URL);
const sql = isolated
  ? postgres(process.env.TEST_DATABASE_URL!, { prepare: false, max: 1 })
  : null;
const profileId = "99999999-9999-4999-8999-999999999999";
const email = "manual-invoice-browser@example.test";
let reservationId: string;
let freeId: string;

test.describe("manual invoices in administration", () => {
  test.skip(!isolated, "requires isolated local Auth/database/provider mocks");
  test.use({
    storageState: join(process.cwd(), "tests", "e2e", ".auth", "admin.json"),
  });
  test.beforeAll(async () => {
    reservationId = randomUUID();
    freeId = randomUUID();
    await sql!`insert into profiles (id,email,full_name,role) values (${profileId},${email},'Fakturová Klientka','member')`;
    for (const [id, price] of [
      [reservationId, 22900],
      [freeId, 0],
    ] as const)
      await sql!`insert into reservation (id,user_id,starts_at,ends_at,status,contact_name,contact_email,price_cents)
        values (${id},${profileId},now()-interval '10 days',now()-interval '10 days'+interval '1 hour','cancelled','Fakturová Klientka',${email},${price})`;
    await sql!`insert into payment (reservation_id,user_id,type,status,amount_cents,paid_at)
      values (${reservationId},${profileId},'one_off','succeeded',22900,now()-interval '11 days')`;
    await sql!`insert into site_setting (key,value) values ('billing.profile',${sql!.json(
      {
        legalName: "Testovací faktura s.r.o.",
        street: "Lokální 1",
        city: "Plzeň",
        zip: "30100",
        ico: "12345678",
        dic: "",
        vatRatePercent: 0,
        bankAccount: "",
        registryNote: "",
      },
    )}) on conflict (key) do update set value=excluded.value`;
  });
  test.afterAll(async () => {
    if (!sql) return;
    await sql`delete from email_archive where provider_message_id in (select provider_message_id from message_delivery where reservation_id in (${reservationId},${freeId}))`;
    await sql`delete from message_delivery where reservation_id in (${reservationId},${freeId})`;
    await sql`delete from payment where reservation_id in (${reservationId},${freeId})`;
    await sql`delete from reservation where id in (${reservationId},${freeId})`;
    await sql`delete from profiles where id=${profileId}`;
    await sql.end({ timeout: 2 });
  });

  test("default operator routing, both recipients, PDF and sent archive work without issuing twice", async ({
    page,
  }) => {
    await page.goto(`/admin/reservations?id=${reservationId}`);
    const select = page.getByRole("combobox", { name: "Příjemce faktury" });
    await expect(select).toHaveValue("operator");
    await page
      .getByRole("button", { name: "Vytvořit a poslat fakturu", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("info@navigym.cz");
    await expect(
      page.getByRole("link", { name: /Stáhnout PDF/ }),
    ).toBeVisible();
    const pdf = await page.request.get(
      (await page
        .getByRole("link", { name: /Stáhnout PDF/ })
        .getAttribute("href")) as string,
    );
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await select.selectOption("both");
    await page
      .getByRole("button", { name: "Vytvořit a poslat fakturu", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(email);
    await page.reload();
    await select.selectOption("both");
    await page
      .getByRole("button", { name: "Vytvořit a poslat fakturu", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(email);
    const invoices =
      await sql!`select id from invoice where reservation_id=${reservationId}`;
    expect(invoices.length).toBe(1);
    expect(
      (
        await sql!`select id from message_delivery where reservation_id=${reservationId} and kind='payment_document' and status='sent'`
      ).length,
    ).toBe(2);
    await page.goto(
      "/admin/messages?q=fakturova+klientka&kind=payment_document",
    );
    const archive = page.locator("table").first();
    await expect(archive.locator("tbody tr")).toHaveCount(2);
    await expect(archive).toContainText("info@navigym.cz");
    await expect(archive).toContainText(email);
    await archive
      .getByRole("link", { name: /Zobrazit/ })
      .first()
      .click();
    await expect(page.getByText(/doklad-.*\.pdf/)).toBeVisible();
    await page.goto(`/admin/doklady?q=${email}`);
    await page
      .getByRole("button", { name: "Poslat znovu", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("odeslán");
    expect(
      (await sql!`select id from invoice where reservation_id=${reservationId}`)
        .length,
    ).toBe(1);
    expect(
      (
        await sql!`select id from message_delivery where reservation_id=${reservationId} and kind='payment_document' and status='sent'`
      ).length,
    ).toBe(3);
  });

  test("profile history has the same controls, free reservations are disabled, and controls are accessible on mobile", async ({
    page,
  }, testInfo) => {
    await page.goto(`/admin/members/${profileId}`);
    await expect(
      page.getByRole("button", {
        name: "Vytvořit a poslat fakturu",
        exact: true,
      }),
    ).toHaveCount(2);
    await page.goto(`/admin/reservations?id=${freeId}`);
    await expect(
      page.getByRole("button", {
        name: "Vytvořit a poslat fakturu",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByText(/Není doložena odpovídající platba/),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`/admin/reservations?id=${reservationId}`);
    await page
      .getByRole("combobox", { name: "Příjemce faktury" })
      .scrollIntoViewIfNeeded();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("manual-invoice-mobile.png"),
    });
  });

  test("captured invoice server action rejects anonymous visitors and members without sending or mutating", async ({
    browser,
    page,
  }) => {
    await page.goto(`/admin/reservations?id=${reservationId}`);
    const request = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"],
    );
    await page
      .getByRole("button", { name: "Vytvořit a poslat fakturu", exact: true })
      .click();
    const action = await request;
    const capturedAction = {
      header: action.headers()["next-action"]!,
      body: action.postData()!,
    };
    await expect(page.getByRole("status")).toContainText("info@navigym.cz");
    const before =
      await sql!`select count(*)::int n from message_delivery where kind='payment_document'`;
    for (const member of [false, true]) {
      const context = await browser.newContext(
        member
          ? {
              storageState: join(
                process.cwd(),
                "tests",
                "e2e",
                ".auth",
                "member.json",
              ),
            }
          : { storageState: { cookies: [], origins: [] } },
      );
      try {
        const response = await context.request.post(
          `http://localhost:3131/admin/reservations?id=${reservationId}`,
          {
            headers: {
              "next-action": capturedAction.header,
              "content-type": "text/plain;charset=UTF-8",
              origin: "http://localhost:3131",
            },
            data: capturedAction.body,
          },
        );
        expect(await response.text()).toContain(
          "Nemáte oprávnění k této akci.",
        );
      } finally {
        await context.close();
      }
    }
    expect(
      (
        await sql!`select count(*)::int n from message_delivery where kind='payment_document'`
      )[0]!.n,
    ).toBe(before[0]!.n);
  });

  test("a lost action response leaves a retryable control and reuses the original document/send", async ({
    page,
  }) => {
    await page.goto(`/admin/reservations?id=${reservationId}`);
    await page
      .getByRole("button", { name: "Vytvořit a poslat fakturu", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("info@navigym.cz");
    const count =
      await sql!`select count(*)::int n from message_delivery where reservation_id=${reservationId}`;
    await page.route("**/admin/reservations?*", async (route) => {
      if (
        route.request().method() === "POST" &&
        route.request().headers()["next-action"]
      )
        await route.abort("connectionreset");
      else await route.continue();
    });
    await page
      .getByRole("button", { name: "Vytvořit a poslat fakturu", exact: true })
      .click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Výsledek odeslání" }),
    ).toContainText("Výsledek odeslání se nepodařilo ověřit");
    await page.unroute("**/admin/reservations?*");
    await page
      .getByRole("button", { name: "Vytvořit a poslat fakturu", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("info@navigym.cz");
    expect(
      (
        await sql!`select count(*)::int n from message_delivery where reservation_id=${reservationId}`
      )[0]!.n,
    ).toBe(count[0]!.n);
  });
});
