import { test, expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
const userId = randomUUID(),
  accountId = randomUUID();
const deliveryId = randomUUID(),
  archiveId = randomUUID(),
  smsId = randomUUID(),
  oldId = randomUUID();
const prefix = `member-ux-${randomUUID()}`;
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test.beforeAll(async () => {
  await sql`insert into profiles(id,email,full_name,role) values(${userId},${prefix + "@example.test"},'Ukázkový kompaktní profil','member')`;
  await sql`insert into credit_account(id,user_id,balance_cents) values(${accountId},${userId},2500)`;
  for (let n = 1; n <= 25; n++)
    await sql`insert into credit_entry(account_id,amount_cents,operation_key,reason,created_at) values(${accountId},100,${prefix + ":" + n},${"Historie položka " + String(n).padStart(2, "0")},${new Date(Date.now() - (26 - n) * 60000)})`;
  await sql`insert into message_delivery(id,user_id,channel,kind,status,recipient,provider_message_id,sent_at) values(${deliveryId},${userId},'email','reservation_confirmation','sent',${prefix + "@example.test"},${prefix + "-email"},now()),(${smsId},${userId},'sms','access_code','sent','+420777000111',null,now()),(${oldId},${userId},'email','access_code','sent',${prefix + "@example.test"},${prefix + "-old"},now()-interval '31 days')`;
  await sql`insert into email_archive(id,provider_message_id,sender,recipient,subject,html,sent_at) values(${archiveId},${prefix + "-email"},'sender@example.test',${prefix + "@example.test"},'Ukázkový archiv zprávy','<p>Uložený obsah ukázkové zprávy.</p>',now()),(${randomUUID()},${prefix + "-old"},'sender@example.test',${prefix + "@example.test"},'Starý archiv','<p>OLD-BODY-MUST-NOT-APPEAR</p>',now()-interval '31 days')`;
});
test.afterAll(async () => {
  await sql`delete from email_archive where provider_message_id like ${prefix + "%"}`;
  await sql`delete from message_delivery where user_id=${userId}`;
  // Financial history is append-only, including in tests. The isolated runner
  // owns the database reset; keep this fictional wallet until that reset.
  await sql.end({ timeout: 2 });
});

async function rejectsNonAdmins(
  browser: Browser,
  page: Page,
  action: { header: string; body: string },
  path: string,
) {
  for (const member of [false, true]) {
    const context = await browser.newContext(
      member
        ? { storageState: join(process.cwd(), "tests/e2e/.auth/member.json") }
        : { storageState: { cookies: [], origins: [] } },
    );
    try {
      const origin = new URL(page.url()).origin;
      const response = await context.request.post(origin + path, {
        headers: {
          "next-action": action.header,
          "content-type": "text/plain;charset=UTF-8",
          origin,
        },
        data: action.body,
      });
      const body = await response.text();
      expect(body).toContain("Nemáte oprávnění k této akci.");
      expect(body).not.toContain("Historie položka");
    } finally {
      await context.close();
    }
  }
}

test("compact member rows, 20-entry credit dialog, gaps and exact message links are accessible and read only", async ({
  page,
  browser,
}, info) => {
  const path = `/admin/members/${userId}`;
  const before =
    await sql`select * from credit_entry where account_id=${accountId} order by id`;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(path);
  const wallet = page.getByRole("region", {
    name: "Kreditní peněženka",
    exact: true,
  });
  await expect(wallet).toContainText("Kredity zákazníka:25 Kč");
  expect((await wallet.boundingBox())!.height).toBeLessThan(90);
  const gap = await page.evaluate(
    () =>
      document
        .querySelector('[data-ui="list-filters"]')!
        .getBoundingClientRect().top -
      document
        .querySelector('section[aria-labelledby="member-details"]')!
        .getBoundingClientRect().bottom,
  );
  expect(gap).toBeGreaterThanOrEqual(24);
  await expect(
    page.getByText("Celkem záznamů: 0", { exact: true }),
  ).toHaveCount(1); // activity only
  await expect(
    page.getByRole("heading", { name: "Odeslané zprávy (3)", exact: true }),
  ).toBeVisible();
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && !!r.headers()["next-action"],
  );
  const trigger = wallet.getByRole("button", {
    name: "Historie kreditů",
    exact: true,
  });
  await trigger.click();
  const captured = await request;
  const dialog = page.getByRole("dialog", {
    name: "Historie kreditů",
    exact: true,
  });
  await expect(dialog.locator("tbody tr")).toHaveCount(20);
  await expect(dialog).toContainText("Historie položka 25");
  await expect(dialog).not.toContainText("Historie položka 01");
  const pager = dialog.getByRole("navigation", {
    name: "Stránkování historie kreditů",
  });
  await pager.getByRole("button", { name: "Další", exact: true }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(5);
  await expect(dialog).toContainText("Historie položka 01");
  await expect(
    pager.getByRole("button", { name: "Další", exact: true }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("member-credit-history-desktop.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await rejectsNonAdmins(
    browser,
    page,
    { header: captured.headers()["next-action"]!, body: captured.postData()! },
    path,
  );
  expect(
    await sql`select * from credit_entry where account_id=${accountId} order by id`,
  ).toEqual(before);
  const messages = page.getByRole("region", {
    name: "Zprávy odeslané členovi",
  });
  await messages.locator(`a[href="/admin/messages/${archiveId}"]`).click();
  await expect(
    page.getByRole("heading", { name: "Ukázkový archiv zprávy" }),
  ).toBeVisible();
  await page.goto(path);
  await messages.locator(`a[href="/admin/messages/${smsId}"]`).click();
  await expect(
    page.getByText("Detail doručení zprávy", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("+420777000111", { exact: true })).toBeVisible();
  await page.goto(`/admin/messages/${oldId}`);
  await expect(page.getByText(/Obsah této zprávy není/)).toBeVisible();
  await expect(page.getByText("OLD-BODY-MUST-NOT-APPEAR")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(path);
  await trigger.click();
  await expect(dialog.locator("tbody tr")).toHaveCount(20);
  await pager.getByRole("button", { name: "Další", exact: true }).click();
  await expect(dialog.locator("tbody tr")).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("member-credit-history-mobile.png"),
  });
});

test("bulk incident resolution accepts no note, preserves new incidents and rejects non-admin actions", async ({
  page,
  browser,
}) => {
  const first = randomUUID(),
    second = randomUUID(),
    later = randomUUID();
  const old = await sql`select id,resolved_at,context from system_alert`;
  const customerData = () =>
    sql`select (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) bookings,(select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by id),'')) from message_delivery m) messages,(select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from access_code c) codes`;
  const before = await customerData();
  try {
    await sql`insert into system_alert(id,title,created_at) values(${first},'První ukázkový incident',now()-interval '1 minute'),(${second},'Druhý ukázkový incident',now()-interval '1 minute')`;
    await page.goto(
      "/admin/alerts?q=" + encodeURIComponent("První ukázkový incident"),
    );
    await page
      .getByRole("button", {
        name: "Označit jako vyřešené: První ukázkový incident",
        exact: true,
      })
      .click();
    const single = page.getByRole("dialog", {
      name: "Uzavřít incident",
      exact: true,
    });
    await expect(
      single.getByLabel("Jak byl incident vyřešen?"),
    ).not.toHaveAttribute("required");
    await single.getByRole("button", { name: "Uložit a uzavřít" }).click();
    await expect(single).not.toBeVisible();
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Posledních 7 dní" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Nedávno uzavřené incidenty" }),
    ).toHaveCount(0);
    await sql`insert into system_alert(id,title,created_at) values(${later},'Nový incident po zobrazení',now()+interval '10 seconds')`;
    await page
      .getByRole("button", { name: "Vyřešit všechny incidenty", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Vyřešit všechny incidenty",
      exact: true,
    });
    await expect(
      dialog.getByLabel("Poznámka k vyřešení (nepovinné)"),
    ).not.toHaveAttribute("required");
    const request = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"],
    );
    await dialog
      .getByRole("button", { name: "Potvrdit vyřešení všech" })
      .click();
    const captured = await request;
    await expect(dialog).not.toBeVisible();
    const saved =
      await sql`select id,resolved_at,context from system_alert where id in (${first},${second},${later})`;
    expect(
      saved.filter((r) => r.id !== later).every((r) => r.resolved_at),
    ).toBe(true);
    expect(saved.find((r) => r.id === later)!.resolved_at).toBeNull();
    await rejectsNonAdmins(
      browser,
      page,
      {
        header: captured.headers()["next-action"]!,
        body: captured.postData()!,
      },
      "/admin",
    );
    expect(await customerData()).toEqual(before);
  } finally {
    await sql`delete from system_alert where id in (${first},${second},${later})`;
    for (const row of old)
      await sql`update system_alert set resolved_at=${row.resolved_at},context=${row.context ? sql.json(row.context) : null} where id=${row.id}`;
  }
});
