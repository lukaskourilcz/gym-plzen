import { test, expect } from "@playwright/test";
import { supabaseConfigured } from "./global-setup";
import postgres from "postgres";
import { isTestDatabaseUrl } from "../helpers/test-database";

const localAuth = process.env.E2E_LOCAL_AUTH === "true";
const sql =
  localAuth && isTestDatabaseUrl(process.env.TEST_DATABASE_URL)
    ? postgres(process.env.TEST_DATABASE_URL!, { prepare: false, max: 1 })
    : null;
test.afterAll(async () => {
  await sql?.end({ timeout: 2 });
});

async function emailToken(
  request: import("@playwright/test").APIRequestContext,
  email: string,
  type: "signup" | "recovery",
) {
  const response = await request.get(
    `http://127.0.0.1:4549/_test/email-token?email=${encodeURIComponent(email)}&type=${type}`,
  );
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { token_hash: string }).token_hash;
}

/** Authentication flows via the UI (Supabase Auth). */
test.describe("Auth", () => {
  test.skip(
    !supabaseConfigured(),
    "requires a configured Supabase (auth) instance",
  );
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    const consent = page
      .getByTestId("tracking-consent")
      .getByRole("button", { name: "Pouze nezbytné" });
    if (await consent.isVisible()) await consent.click();
  });

  test("member can sign in and reach their account", async ({ page }) => {
    await page.goto("/login?next=/account");
    await page.getByLabel(/E-mail/i).fill("member@example.test");
    await page.getByLabel(/Heslo/i).fill(process.env.E2E_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: /Přihlásit se/i }).click();

    await expect(page).toHaveURL(/\/account/);
    await expect(
      page.getByRole("heading", { name: /Dobrý den, Member/i }),
    ).toBeVisible();
    // Loyalty widget renders.
    await expect(page.getByText(/Věrnostní program/i)).toBeVisible();
  });

  test("sign-in rejects an incorrect password without opening the account", async ({
    page,
  }) => {
    await page.getByLabel(/E-mail/i).fill("member@example.test");
    await page.getByLabel(/Heslo/i).fill("incorrect-password-e2e");
    await page.getByRole("button", { name: /Přihlásit se/i }).click();
    await expect(
      page.getByText("E-mail nebo heslo není správné."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("registration validates a short password before submission", async ({
    page,
  }) => {
    await page.goto("/login");
    // Switch to sign-up so the 8-char rule applies, then submit a short password.
    await page.getByRole("button", { name: /Zaregistrujte se/i }).click();
    await page.getByLabel(/Jméno/i).fill("Test");
    await page.getByLabel(/E-mail/i).fill("bad@example.test");
    await page.getByLabel(/Heslo/i).fill("123");
    await page.getByRole("button", { name: /Zaregistrovat se/i }).click();
    await expect(page.getByText(/alespoň 8 znaků/i)).toBeVisible();
  });

  test("admin sign-in reaches the dashboard", async ({ page }) => {
    await page.goto("/login?next=/admin");
    await page.getByLabel(/E-mail/i).fill("admin@example.test");
    await page.getByLabel(/Heslo/i).fill(process.env.E2E_TEST_PASSWORD ?? "");
    await page.getByRole("button", { name: /Přihlásit se/i }).click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: /Dnes/i })).toBeVisible();
  });

  test("new member confirms the emailed link in another browser before signing in", async ({
    page,
    browser,
    request,
  }) => {
    test.skip(!localAuth, "requires the isolated local Auth email fixture");
    const email = `registration-${process.env.E2E_RUN_ID}@example.test`;
    await page.getByRole("button", { name: /Zaregistrujte se/i }).click();
    await page.getByLabel(/Jméno/i).fill("Nový Člen");
    await page.getByLabel(/E-mail/i).fill(email);
    await page.getByLabel(/Heslo/i).fill("local-registration-password");
    await page.getByRole("button", { name: /Zaregistrovat se/i }).click();
    await expect(
      page.getByText(/Dokončete registraci přes odkaz v e-mailu/),
    ).toBeVisible();
    const [before] =
      await sql!`select count(*)::int as count from profiles where email = ${email}`;
    expect(before?.count).toBe(0);

    const token = await emailToken(request, email, "signup");
    const other = await browser.newContext();
    try {
      const confirm = await other.newPage();
      await confirm.goto(
        `/auth/confirm?type=signup&token_hash=${encodeURIComponent(token)}`,
      );
      await expect(confirm).toHaveURL(/\/account(?:[/?#]|$)/);
      await expect(
        confirm.getByRole("heading", { name: /Dobrý den, Nový/i }),
      ).toBeVisible();
      const [after] =
        await sql!`select full_name, role from profiles where email = ${email}`;
      expect(after).toMatchObject({ full_name: "Nový Člen", role: "member" });
      const [history] =
        await sql!`select count(*)::int as count from activity_log a join profiles p on p.id = a.member_id where p.email = ${email} and a.action = 'member.registered'`;
      expect(history?.count).toBe(1);
    } finally {
      await other.close();
    }
    const replay = await browser.newContext();
    try {
      const expired = await replay.newPage();
      await expired.goto(
        `/auth/confirm?type=signup&token_hash=${encodeURIComponent(token)}`,
      );
      await expect(expired).toHaveURL(/\/login\?chyba=vyprselo/);
    } finally {
      await replay.close();
    }
  });

  test("password recovery link allows one password change and the new password signs in", async ({
    page,
    browser,
    request,
  }) => {
    test.skip(!localAuth, "requires the isolated local Auth email fixture");
    await page.goto("/forgot-password");
    await page.getByLabel("E-mail").fill("member@example.test");
    await page.getByRole("button", { name: "Poslat odkaz pro obnovu" }).click();
    await expect(
      page.getByText(/Pokud účet existuje, odeslali jsme odkaz/),
    ).toBeVisible();
    const token = await emailToken(request, "member@example.test", "recovery");
    const fresh = await browser.newContext();
    try {
      const reset = await fresh.newPage();
      await reset.goto(
        `/auth/confirm?type=recovery&token_hash=${encodeURIComponent(token)}`,
      );
      await expect(reset).toHaveURL(/\/reset-password/);
      await reset
        .getByTestId("tracking-consent")
        .getByRole("button", { name: "Pouze nezbytné" })
        .click();
      await reset
        .getByLabel("Nové heslo", { exact: true })
        .fill("changed-local-password-e2e");
      await reset
        .getByLabel("Nové heslo znovu")
        .fill("changed-local-password-e2e");
      await reset.getByRole("button", { name: "Uložit nové heslo" }).click();
      await expect(reset).toHaveURL(/\/account/);
    } finally {
      await fresh.close();
    }
    const signin = await browser.newContext();
    try {
      const login = await signin.newPage();
      await login.goto("/login");
      await login
        .getByTestId("tracking-consent")
        .getByRole("button", { name: "Pouze nezbytné" })
        .click();
      await login.getByLabel(/E-mail/i).fill("member@example.test");
      await login.getByLabel(/Heslo/i).fill("changed-local-password-e2e");
      await login.getByRole("button", { name: /Přihlásit se/i }).click();
      await expect(login).toHaveURL(/\/account/);
    } finally {
      await signin.close();
    }
  });
});
