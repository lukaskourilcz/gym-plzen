import { test, expect } from "@playwright/test";
import { join } from "node:path";
import { supabaseConfigured } from "./global-setup";

// Admin flows need a real Supabase session; skip when Supabase isn't configured.
test.skip(
  !supabaseConfigured(),
  "requires a configured Supabase (auth) instance",
);

// All tests in this file run as the admin.
test.use({
  storageState: join(process.cwd(), "tests", "e2e", ".auth", "admin.json"),
});

/** Future datetime-local value (next week at a fixed hour). */
function futureSlot(hour: number): { start: string; end: string; date: Date } {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const end = new Date(d.getTime() + 60 * 60 * 1000);
  return { start: fmt(d), end: fmt(end), date: d };
}

const ADMIN_PAGES: { path: string; heading: RegExp }[] = [
  { path: "/admin", heading: /Přehled/i },
  { path: "/admin/calendar", heading: /Kalendář/i },
  { path: "/admin/reservations", heading: /Rezervace/i },
  { path: "/admin/schedule", heading: /Otevírací doba/i },
  { path: "/admin/members", heading: /Členové/i },
  { path: "/admin/memberships", heading: /Vstupné a věrnost/i },
  { path: "/admin/statistics", heading: /Statistiky/i },
  { path: "/admin/content", heading: /Obsah webu/i },
  { path: "/admin/settings", heading: /Nastavení a branding/i },
  { path: "/admin/messages", heading: /Doručené zprávy/i },
  { path: "/admin/entry-log", heading: /Kniha vstupů/i },
  { path: "/admin/alerts", heading: /Upozornění/i },
  { path: "/admin/inspirations", heading: /Inspirace/i },
  { path: "/admin/plan", heading: /Plán spuštění/i },
];

test.describe("Admin : pages load", () => {
  for (const p of ADMIN_PAGES) {
    test(`loads ${p.path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      await page.goto(p.path);
      await expect(
        page.getByRole("heading", { name: p.heading }).first(),
      ).toBeVisible();
      expect(errors, `console page errors on ${p.path}`).toEqual([]);
    });
  }

  test("calendar renders FullCalendar", async ({ page }) => {
    await page.goto("/admin/calendar");
    await expect(page.locator(".fc")).toBeVisible();
  });

  test("plan page shows a progress percentage", async ({ page }) => {
    await page.goto("/admin/plan");
    await expect(page.getByText(/%/).first()).toBeVisible();
  });
});

test.describe("Admin : forms", () => {
  test("content editor saves a block", async ({ page }) => {
    await page.goto("/admin/content");
    // Target a specific, known block by its exact <code> key (the key-field
    // label also contains this string, so match exactly).
    const details = page.locator("details", {
      has: page.getByText("home.hero.title", { exact: true }),
    });
    await details.evaluate((d: HTMLDetailsElement) => (d.open = true));
    const textarea = details.locator('textarea[name="valueText"]');
    await expect(textarea).toBeVisible();
    await textarea.fill("Upravený text E2E");
    await details.getByRole("button", { name: /Uložit změny/i }).click();
    await expect(details.getByText(/Obsah uložen/i)).toBeVisible();
  });

  test("pricing form saves the entry price", async ({ page }) => {
    await page.goto("/admin/memberships");
    const input = page.getByLabel(/Cena jednorázového vstupu/i);
    await input.fill("300");
    await page.getByRole("button", { name: /Uložit cenu/i }).click();
    await expect(page.getByText(/Cena vstupného uložena/i)).toBeVisible();
  });

  test("settings saves the SMS template", async ({ page }) => {
    await page.goto("/admin/settings");
    const ta = page.getByLabel(/Text SMS s kódem/i);
    await ta.fill("Kod: {code} v {time}");
    await page.getByRole("button", { name: /Uložit šablonu/i }).click();
    await expect(page.getByText(/Šablona uložena/i)).toBeVisible();
  });

  test("schedule adds a blocked slot", async ({ page }) => {
    await page.goto("/admin/schedule");
    const { start, end } = futureSlot(13);
    // The blocked-slot form is the one with a "Přidat blok" button.
    const form = page.locator("form").filter({ hasText: "Přidat blok" });
    await form.locator('input[type="datetime-local"]').first().fill(start);
    await form.locator('input[type="datetime-local"]').nth(1).fill(end);
    await form.getByRole("button", { name: /Přidat blok/i }).click();
    await expect(page.getByText(/Blok vytvořen|Úklid/i).first()).toBeVisible();
  });

  test("reservations : admin creates a manual booking", async ({ page }) => {
    await page.goto("/admin/reservations");
    const { start, end } = futureSlot(9);
    const form = page.locator("form").filter({ hasText: "Vytvořit rezervaci" });
    await form.locator('input[type="datetime-local"]').first().fill(start);
    await form.locator('input[type="datetime-local"]').nth(1).fill(end);
    await form.getByLabel(/Jméno zákazníka/i).fill("E2E Zákazník");
    await form.getByLabel(/E-mail/i).fill("e2e@test.cz");
    await form.getByRole("button", { name: /Vytvořit rezervaci/i }).click();
    await expect(page.getByText(/Rezervace vytvořena/i)).toBeVisible();
    // The new booking appears in the list.
    await expect(page.getByText("E2E Zákazník").first()).toBeVisible();
  });
});
