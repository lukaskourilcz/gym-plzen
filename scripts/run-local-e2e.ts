import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../tests/helpers/test-database";
import { createLocalAuth } from "../tests/e2e/local-auth";
import { createResendMock } from "../tests/integration/mocks";
import { BOOKING_TABLES } from "../tests/helpers/booking-tables";

const database = requireTestDatabaseUrl();
for (const file of [
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
])
  if (existsSync(file))
    throw new Error(
      "Run local E2E in a clean worktree without environment files.",
    );

// Do not inherit application credentials from the invoking shell.
const testEnv: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TZ: "UTC",
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: database,
  TEST_DATABASE_URL: database,
  REQUIRE_DB: "1",
  E2E_LOCAL_AUTH: "true",
  E2E_PORT: "3131",
  E2E_RUN_ID: randomUUID(),
  // The adapter correctly requires HTTPS return URLs, even for a mock charge.
  // Browser navigations still use Playwright's loopback baseURL.
  NEXT_PUBLIC_APP_URL: "https://navigym.test",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4549",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-anon-key",
  SUPABASE_SECRET_KEY: "local-admin-key",
  NEXT_PUBLIC_OAUTH_PROVIDERS: "google",
  NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-LOCALTEST",
  NEXT_PUBLIC_META_PIXEL_ID: "0000000000",
  RESEND_BASE_URL: "http://127.0.0.1:4548",
  RESEND_API_KEY: "re_local_test_only",
  RESEND_FROM_EMAIL: "noreply@example.test",
  ACCESS_CODE_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  COMGATE_API_URL: "http://127.0.0.1:4547/v2.0",
  COMGATE_MERCHANT_ID: "test-merchant",
  COMGATE_SECRET: "test-secret",
  COMGATE_TEST_MODE: "true",
};
if (process.env.PW_CHROMIUM_PATH)
  testEnv.PW_CHROMIUM_PATH = process.env.PW_CHROMIUM_PATH;

function run(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env: testEnv,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Local test process exited ${code}.`)),
    );
  });
}
const sql = postgres(database, { prepare: false, max: 1 });
try {
  // A browser run begins with the same fictional fixtures every time. This
  // URL has already passed requireTestDatabaseUrl's loopback/test-name gate.
  await sql.unsafe(
    `TRUNCATE ${BOOKING_TABLES.map((table) => `public.${table}`).join(", ")} RESTART IDENTITY CASCADE`,
  );
  // Provider fixtures restart their message IDs on every run. Retained email
  // bodies from an earlier run must not collide with this run's fake IDs.
  await sql`delete from email_archive`;
  await sql`delete from content_block where key = 'home.hero.title' and locale = 'cs'`;
  for (let weekday = 0; weekday < 7; weekday++)
    await sql`insert into opening_hours (day_of_week, open_minute, close_minute, slot_minutes)
      values (${weekday}, 300, 1425, 75)
      on conflict (day_of_week) do update set
        open_minute = excluded.open_minute,
        close_minute = excluded.close_minute,
        slot_minutes = excluded.slot_minutes,
        is_closed = 0`;
  for (const [key, value] of [
    [
      "booking.operations",
      { paymentsEnabled: true, accessCodesEnabled: false, bookingsFrom: "" },
    ],
    [
      "notifications.operator",
      {
        recipients: "",
        events: {
          reservationConfirmed: false,
          reservationRescheduled: false,
          reservationCancelled: false,
          memberRegistered: false,
          systemAlert: false,
        },
      },
    ],
    ["pricing.entry_price_cents", 22_900],
  ] as const)
    await sql`insert into site_setting (key, value) values (${key}, ${sql.json(value)})
      on conflict (key) do update set value = excluded.value`;
} finally {
  await sql.end({ timeout: 2 });
}
await run(["node_modules/next/dist/bin/next", "build"]);
const auth = createLocalAuth(4549);
const resend = createResendMock(4548);
let app: ChildProcess | undefined;
try {
  await auth.start();
  await resend.start();
  app = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./tests/helpers/local-network.ts",
      "node_modules/next/dist/bin/next",
      "start",
      "-p",
      "3131",
      "-H",
      "127.0.0.1",
    ],
    { env: testEnv, stdio: "inherit" },
  );
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (app.exitCode !== null)
      throw new Error("Local E2E app exited before readiness.");
    try {
      const response = await fetch("http://localhost:3131/login", {
        signal: AbortSignal.timeout(1000),
      });
      if (
        response.ok &&
        response.headers.get("x-navi-test-run") === testEnv.E2E_RUN_ID
      ) {
        ready = true;
        break;
      }
    } catch {
      /* Wait for startup only; no external calls. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Local E2E app did not become ready.");
  await run([
    "node_modules/@playwright/test/cli.js",
    "test",
    ...(process.argv.length > 2
      ? process.argv.slice(2)
      : [
          "public.spec.ts",
          "auth.spec.ts",
          "admin.spec.ts",
          "admin-filtering.spec.ts",
          "manual-invoices.spec.ts",
          "booking-flow.spec.ts",
          "customer.spec.ts",
          "analytics.spec.ts",
          "design-preview-gate.spec.ts",
          "accessibility.spec.ts",
          "outage.spec.ts",
        ]),
  ]);
  console.log(
    `Local E2E complete; ${resend.sent.length} messages recorded by the local fixture.`,
  );
} finally {
  if (app && app.exitCode === null) {
    const stopped = new Promise<void>((resolve) =>
      app!.once("exit", () => resolve()),
    );
    app.kill("SIGTERM");
    await stopped;
  }
  await resend.stop();
  await auth.stop();
}
