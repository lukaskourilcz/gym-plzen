/**
 * Real password-recovery flow against isolated local Supabase Auth and a local
 * disposable _test database. Start Supabase first, then set
 * LOCAL_SUPABASE_WORKDIR and TEST_DATABASE_URL. No email is sent: the local
 * Auth admin API generates a recovery link in memory for a synthetic user.
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const workdir = process.env.LOCAL_SUPABASE_WORKDIR;
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!workdir || !databaseUrl) throw new Error("Local test inputs are required");
const database = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(database.hostname) ||
  !/(?:^|_)test(?:_|$)/.test(database.pathname.slice(1))
)
  throw new Error("Refusing a non-local or non-test database");

const raw = execFileSync(
  "npx",
  ["--no-install", "supabase", "status", "--workdir", workdir, "-o", "json"],
  { stdio: ["ignore", "pipe", "ignore"] },
);
const local = JSON.parse(raw.toString());
if (!["127.0.0.1", "localhost"].includes(new URL(local.API_URL).hostname))
  throw new Error("Refusing non-local Supabase Auth");

// Use one hostname throughout: localhost and 127.0.0.1 have separate cookies.
const appUrl = "http://localhost:3105";
const appEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  NEXT_PUBLIC_APP_URL: appUrl,
  NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
  ACCESS_CODE_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  NEXT_TELEMETRY_DISABLED: "1",
};
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = `recovery-browser-${randomBytes(6).toString("hex")}@example.test`;
const first = `${randomBytes(24).toString("hex")}A!`;
const second = `${randomBytes(24).toString("hex")}B!`;
let stage = "setup";
let server;
let browser;
let userId;
try {
  const created = await admin.auth.admin.createUser({
    email,
    password: first,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw new Error("createUser");
  userId = created.data.user.id;

  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-H", "localhost", "-p", "3105"],
    { cwd: process.cwd(), env: appEnv, stdio: "ignore" },
  );
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if ((await fetch(`${appUrl}/login`)).ok) {
        ready = true;
        break;
      }
    } catch {
      // The isolated local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!ready) throw new Error("Next server did not start");

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  stage = "ordinary sign-in";
  await page.goto(`${appUrl}/login`);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo", { exact: true }).fill(first);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await page.waitForURL((url) => url.pathname !== "/login", {
    timeout: 90_000,
  });
  await page.goto(`${appUrl}/account`);
  assert.equal(new URL(page.url()).pathname, "/account");

  stage = "bare session refused";
  await page.goto(`${appUrl}/reset-password`);
  assert.equal(new URL(page.url()).pathname, "/reset-password");
  assert.equal(
    await page.getByRole("button", { name: "Uložit nové heslo" }).count(),
    0,
  );

  stage = "recovery link";
  const link = await admin.auth.admin.generateLink({ type: "recovery", email });
  const hash = link.data?.properties?.hashed_token;
  if (link.error || !hash) throw new Error("generateLink");
  await page.goto(
    `${appUrl}/auth/confirm?type=recovery&token_hash=${encodeURIComponent(hash)}`,
  );
  await page.waitForURL(/\/reset-password(?:\?|$)/, { timeout: 90_000 });
  await page
    .getByRole("button", { name: "Uložit nové heslo" })
    .waitFor({ timeout: 30_000 });

  stage = "password update";
  await page.getByLabel("Nové heslo", { exact: true }).fill(second);
  await page.getByLabel("Nové heslo znovu").fill(second);
  await page.getByRole("button", { name: "Uložit nové heslo" }).click();
  await page.waitForURL(/\/account(?:\?|$)/, { timeout: 90_000 });
  await page.goto(`${appUrl}/reset-password`);
  assert.equal(
    await page.getByRole("button", { name: "Uložit nové heslo" }).count(),
    0,
  );

  stage = "new password login";
  const check = createClient(local.API_URL, local.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await check.auth.signInWithPassword({
    email,
    password: second,
  });
  assert.equal(login.error, null);
  assert.equal(login.data.user?.id, userId);
  process.stdout.write("local_browser_recovery:pass\n");
} catch (error) {
  // Never print a URL, credential, cookie or provider response.
  process.stderr.write(
    `local_browser_recovery:${stage}:${error instanceof Error ? error.name : "failed"}\n`,
  );
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) server.kill("SIGTERM");
  if (userId) await admin.auth.admin.deleteUser(userId);
}
