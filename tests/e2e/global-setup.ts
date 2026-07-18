import { chromium, request, type FullConfig } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Global setup: sign in the pre-created admin and member accounts via the
 * Better Auth API and persist their storage states, so tests can start already
 * authenticated. The users are created (and the admin promoted) by the run
 * script before Playwright starts.
 */
async function saveState(baseURL: string, email: string, file: string) {
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post("/api/auth/sign-in/email", {
    data: { email, password: "password123" },
  });
  if (!res.ok()) {
    throw new Error(`Sign-in failed for ${email}: ${res.status()} ${await res.text()}`);
  }
  const state = await ctx.storageState();
  writeFileSync(file, JSON.stringify(state));
  await ctx.dispose();
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? `http://localhost:${process.env.E2E_PORT ?? "3131"}`;
  const dir = join(process.cwd(), "tests", "e2e", ".auth");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(dir, { recursive: true });
  await saveState(baseURL, "admin@test.cz", join(dir, "admin.json"));
  await saveState(baseURL, "member@test.cz", join(dir, "member.json"));
  // Touch chromium so a misconfigured browser path fails fast here, not mid-test.
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  await browser.close();
}
