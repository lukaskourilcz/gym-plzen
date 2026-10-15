import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
const prefix = `phone-${randomUUID()}`;
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});

test("registration asks for a phone while existing login remains unchanged", async ({
  page,
}) => {
  await page.goto("/login");
  const consent = page
    .getByTestId("tracking-consent")
    .getByRole("button", { name: "Pouze nezbytné" });
  if (await consent.isVisible()) await consent.click();
  await page.getByRole("button", { name: /Zaregistrujte se/i }).click();
  const phone = page.getByLabel("Telefon", { exact: true });
  await expect(phone).toHaveAttribute("required");
  await page.getByLabel("Jméno", { exact: true }).fill("Nový zákazník");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(prefix + "@example.test");
  await page.getByLabel("Heslo", { exact: true }).fill("local-test-password");
  await page
    .getByRole("button", { name: "Zaregistrovat se", exact: true })
    .click();
  expect(
    await phone.evaluate(
      (input: HTMLInputElement) => input.validity.valueMissing,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: /Máte účet\? Přihlaste se/ }).click();
  await expect(phone).toHaveCount(0);
});

test("new account without provider phone completes contact before entering the account", async ({
  page,
  request,
}) => {
  const email = prefix + "-provider@example.test";
  const created = await request.post(
    "http://127.0.0.1:4549/auth/v1/admin/users",
    {
      headers: { Authorization: "Bearer local-admin-key" },
      data: {
        email,
        password: "local-provider-password",
        user_metadata: { full_name: "Nový Google" },
      },
    },
  );
  expect(created.ok()).toBe(true);
  await page.goto("/login?next=/account");
  const consent = page
    .getByTestId("tracking-consent")
    .getByRole("button", { name: "Pouze nezbytné" });
  if (await consent.isVisible()) await consent.click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page
    .getByLabel("Heslo", { exact: true })
    .fill("local-provider-password");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Doplňte telefonní číslo" }),
  ).toBeVisible();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account\/telefon/);
  await page.getByLabel("Telefon", { exact: true }).fill("777 123 456");
  await page.getByRole("button", { name: "Uložit a pokračovat" }).click();
  await expect(
    page.getByRole("heading", { name: /Dobrý den, Nový/ }),
  ).toBeVisible();
  const [profile] =
    await sql`select phone,phone_required,role from profiles where email=${email}`;
  expect(profile).toMatchObject({
    phone: "+420777123456",
    phone_required: true,
    role: "member",
  });
});

test("members list distinguishes and filters guests without mutating reservations or sending messages", async ({
  browser,
}) => {
  const memberId = randomUUID();
  await sql`insert into profiles(id,email,full_name) values (${memberId},${prefix + "-registered@example.test"},${prefix + " člen"})`;
  const [guest] =
    await sql`insert into reservation(starts_at,ends_at,status,contact_name,contact_email,contact_phone)
    values ('2030-01-01 10:00Z','2030-01-01 11:00Z','cancelled',${prefix + " host"},${prefix + "-guest@example.test"},'+420777987654') returning id`;
  const before = await sql`select * from reservation order by id`;
  const [emails] = await sql`select count(*)::int as n from email_archive`;
  const context = await browser.newContext({
    storageState: join(process.cwd(), "tests/e2e/.auth/admin.json"),
  });
  try {
    const page = await context.newPage();
    await page.goto(`/admin/members?q=${prefix}`);
    const guestRow = page
      .getByRole("row")
      .filter({ hasText: prefix + " host" });
    const memberRow = page
      .getByRole("row")
      .filter({ hasText: prefix + " člen" });
    await expect(
      guestRow.getByText("Neregistrovaný", { exact: true }),
    ).toBeVisible();
    await expect(
      guestRow.getByText("+420777987654", { exact: true }),
    ).toBeVisible();
    await expect(guestRow.getByRole("link")).toHaveAttribute(
      "href",
      /\/admin\/reservations\?q=/,
    );
    await expect(
      memberRow.getByText("Registrovaný", { exact: true }),
    ).toBeVisible();
    await expect(
      memberRow.getByText("Neuvedeno", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("combobox", { name: "Registrace", exact: true })
      .selectOption("guest");
    await page.getByRole("button", { name: /Použít filtry|Filtrovat/ }).click();
    await expect(
      page.getByRole("row").filter({ hasText: prefix + " člen" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("row").filter({ hasText: prefix + " host" }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: "/tmp/gym-phone-members.png",
      fullPage: true,
    });
    expect(await sql`select * from reservation order by id`).toEqual(before);
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emails!.n);
  } finally {
    await context.close().catch(() => {});
    await sql`delete from reservation where id=${guest!.id}`;
    await sql`delete from profiles where id=${memberId}`;
  }
});
