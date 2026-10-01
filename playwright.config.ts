import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config. Tests run against an already-running app
 * (`npm run build && npm start`) on PORT (default 3131) with a real Postgres.
 * The pre-provisioned Chromium in this environment is used via
 * `PW_CHROMIUM_PATH` when set. See scripts/run-local-e2e.ts.
 */
const PORT = process.env.E2E_PORT ?? "3131";
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
});
