import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Global setup for the auth/admin specs (Supabase Auth).
 *
 * Requires Supabase to be configured (NEXT_PUBLIC_SUPABASE_URL + a secret key).
 * When it isn't, we still write empty storage states so `storageState` paths
 * resolve, and the auth/admin specs skip themselves (see supabaseConfigured()).
 *
 * When configured, we create the admin/member test users via the Admin API,
 * set the admin role in `profiles`, then drive the login form in a browser to
 * capture each user's Supabase session cookies as a storage state.
 */
// A fresh password per run: the accounts may outlive the run on the test
// project, and a well-known admin password there would be a standing risk.
// Shared with the specs through the environment (Playwright passes what global
// setup sets on to the workers).
process.env.E2E_TEST_PASSWORD ??= `e2e-${randomBytes(18).toString("base64url")}`;
const CRED = { password: process.env.E2E_TEST_PASSWORD };
/** The live project; e2e never creates accounts or writes there. */
const PRODUCTION_PROJECT_REF = "rkmunagymohxtclymacm";
const USERS = [
  {
    email: "admin@example.test",
    role: "admin",
    name: "Admin Test",
    file: "admin.json",
  },
  {
    email: "member@example.test",
    role: "member",
    name: "Member Test",
    file: "member.json",
  },
];

export function supabaseConfigured(): boolean {
  if (
    process.env.E2E_SUPABASE_PROJECT_REF === PRODUCTION_PROJECT_REF ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(PRODUCTION_PROJECT_REF)
  )
    return false;
  let matchingHost = false;
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    matchingHost =
      url.protocol === "https:" &&
      url.hostname === `${process.env.E2E_SUPABASE_PROJECT_REF}.supabase.co` &&
      !url.username &&
      !url.password;
  } catch {
    /* Unconfigured or invalid. */
  }
  return Boolean(
    process.env.E2E_ALLOW_REMOTE_MUTATIONS === "true" &&
    process.env.E2E_SUPABASE_PROJECT_REF &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    matchingHost &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  );
}

export default async function globalSetup(config: FullConfig) {
  const dir = join(process.cwd(), "tests", "e2e", ".auth");
  mkdirSync(dir, { recursive: true });
  const empty = JSON.stringify({ cookies: [], origins: [] });
  for (const u of USERS) writeFileSync(join(dir, u.file), empty);

  if (!supabaseConfigured()) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = (process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY)!;
  const baseURL =
    config.projects[0]?.use?.baseURL ??
    `http://localhost:${process.env.E2E_PORT ?? "3131"}`;

  const admin = createClient(url, secret, { auth: { persistSession: false } });

  for (const u of USERS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: CRED.password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    let id = data.user?.id;
    if (error) {
      if (error.code !== "email_exists")
        throw new Error(
          `E2E user creation failed (${error.code ?? "unknown"}).`,
        );
      const { data: listed, error: listError } =
        await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw new Error("E2E could not find existing test users.");
      id = listed.users.find((user) => user.email === u.email)?.id;
      if (!id)
        throw new Error(
          "Existing E2E account was not found; refusing an unauthenticated run.",
        );
      const { error: updateError } = await admin.auth.admin.updateUserById(id, {
        password: CRED.password,
        email_confirm: true,
      });
      if (updateError)
        throw new Error("E2E could not reset the test account password.");
    }
    if (!id) throw new Error("E2E user creation returned no account.");
    {
      const { error: profileError } = await admin
        .from("profiles")
        .upsert({ id, email: u.email, full_name: u.name, role: u.role });
      if (profileError) throw new Error("E2E profile/role setup failed.");
    }
  }

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  for (const u of USERS) {
    const page = await browser.newPage({ baseURL });
    await page.goto("/login");
    await page.getByLabel(/E-mail/i).fill(u.email);
    await page.getByLabel(/Heslo/i).fill(CRED.password);
    await page.getByRole("button", { name: /Přihlásit se/i }).click();
    await page.waitForURL(/\/(account|admin)(?:[/?#]|$)/, { timeout: 15_000 });
    await page.context().storageState({ path: join(dir, u.file) });
    await page.close();
  }
  await browser.close();
}
