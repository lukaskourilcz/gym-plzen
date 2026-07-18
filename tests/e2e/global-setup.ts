import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
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
const CRED = { password: "password123" };
const USERS = [
  { email: "admin@test.cz", role: "admin", name: "Admin Test", file: "admin.json" },
  { email: "member@test.cz", role: "member", name: "Member Test", file: "member.json" },
];

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
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
  const secret = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)!;
  const baseURL =
    config.projects[0]?.use?.baseURL ?? `http://localhost:${process.env.E2E_PORT ?? "3131"}`;

  const admin = createClient(url, secret, { auth: { persistSession: false } });

  for (const u of USERS) {
    const { data } = await admin.auth.admin.createUser({
      email: u.email,
      password: CRED.password,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });
    const id = data.user?.id;
    if (id) {
      await admin.from("profiles").upsert({ id, email: u.email, full_name: u.name, role: u.role });
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
    await page.waitForURL(/\/(account|admin)/, { timeout: 15_000 }).catch(() => {});
    await page.context().storageState({ path: join(dir, u.file) });
    await page.close();
  }
  await browser.close();
}
