import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { openCalendarTomorrow } from "../helpers/admin-calendar";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
} from "../../src/lib/helpers/datetime";

const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
// Deliberately fixed loopback fixture; never take an Auth URL/key from a live environment.
const auth = createClient("http://127.0.0.1:4549", "local-admin-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});
const adminState = join(process.cwd(), "tests/e2e/.auth/admin.json");
test.use({ storageState: adminState });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});

async function fixture(page: Page) {
  const suffix = randomUUID().slice(0, 8),
    email = `typo-${suffix}@example.test`,
    password = "LocalContact2026!";
  const { data, error } = await auth.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Markéta Testová" },
  });
  expect(error).toBeNull();
  const id = data.user!.id;
  await sql`insert into profiles(id,email,full_name,phone,phone_required,phone_verified,note) values(${id},${email},'Markéta Testová','+420777222333',true,true,'Domluvit první návštěvu.')`;
  const day = addDaysToDateKey(dateKeyInTimeZone(new Date()), 1);
  const response = await page.request.get(
    `/api/availability/calendar?date=${day}`,
  );
  expect(response.status()).toBe(200);
  const view = await response.json();
  const free = view.selectedSlots.filter(
    (s: { booked?: boolean }) => !s.booked,
  );
  expect(free.length).toBeGreaterThanOrEqual(4);
  const start = new Date(free[0].startISO),
    end = new Date(start.getTime() + 75 * 60000);
  const [booking] =
    await sql`insert into reservation(user_id,starts_at,ends_at,status,price_cents,contact_name,contact_email,contact_phone) values(${id},${start},${end},'confirmed',23900,'Markéta Testová',${email},'+420777222333') returning id`;
  await sql`insert into access_code(reservation_id,code_hash,nuki_auth_id,valid_from,valid_until,status) values(${booking!.id},'synthetic-browser-only','synthetic-nuki-id',${start},${end},'scheduled')`;
  return { id, email, password, suffix, day, free, bookingId: booking!.id };
}
async function protectedState() {
  return sql`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as bookings,
    (select md5(coalesce(string_agg(to_jsonb(c)::text,'' order by id),'')) from access_code c) as codes,
    (select md5(coalesce(string_agg(to_jsonb(p)::text,'' order by id),'')) from payment p) as payments,
    (select md5(coalesce(string_agg(to_jsonb(m)::text,'' order by id),'')) from message_delivery m) as messages,
    (select md5(coalesce(string_agg(to_jsonb(e)::text,'' order by id),'')) from email_archive e) as emails`;
}
async function cleanup(id: string, reservationIds: string[] = []) {
  for (const reservationId of reservationIds)
    await sql`delete from reservation where id=${reservationId}`;
  await sql`delete from reservation where user_id=${id}`;
  await sql`delete from activity_log where member_id=${id}`;
  await sql`delete from profiles where id=${id}`;
}

test("administrator corrects contact and login email without changing reservations, codes or sending; anonymous and member replays are rejected", async ({
  page,
  browser,
}) => {
  const f = await fixture(page),
    corrected = `corrected-${f.suffix}@example.test`;
  try {
    await page.goto(`/admin/members/${f.id}`);
    const before = await protectedState();
    await page
      .getByRole("button", { name: "Upravit údaje", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Upravit údaje zákazníka",
    });
    await expect(dialog.getByLabel("Jméno a příjmení")).toBeFocused();
    await dialog.getByLabel("Jméno a příjmení").fill("Markéta Opravená");
    await dialog.getByLabel("E-mail", { exact: true }).fill(corrected);
    await dialog.getByLabel("Telefon", { exact: true }).fill("777 555 666");
    const shadowEmail = `shadow-${f.suffix}@example.test`;
    const shadow = await auth.auth.admin.createUser({
      email: shadowEmail,
      password: f.password,
      email_confirm: true,
    });
    expect(shadow.error).toBeNull();
    await dialog.getByLabel("E-mail", { exact: true }).fill(shadowEmail);
    await dialog
      .getByRole("button", { name: "Uložit údaje", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      "Tento e-mail už používá jiný zákazník.",
    );
    expect(
      (await sql`select email from profiles where id=${f.id}`)[0]!.email,
    ).toBe(f.email);
    await dialog.getByLabel("E-mail", { exact: true }).fill(corrected);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const accessibility = await new AxeBuilder({ page })
      .include("dialog")
      .analyze();
    expect(
      accessibility.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    const submitted = page.waitForRequest(
      (req) => req.method() === "POST" && Boolean(req.headers()["next-action"]),
    );
    await dialog
      .getByRole("button", { name: "Uložit údaje", exact: true })
      .click();
    const request = await submitted;
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Údaje zákazníka uloženy." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Markéta Opravená/ }),
    ).toBeVisible();
    expect((await auth.auth.admin.getUserById(f.id)).data.user?.email).toBe(
      corrected,
    );
    const oldLogin = await auth.auth.signInWithPassword({
      email: f.email,
      password: f.password,
    });
    expect(oldLogin.error).not.toBeNull();
    const newLogin = await auth.auth.signInWithPassword({
      email: corrected,
      password: f.password,
    });
    expect(newLogin.error).toBeNull();
    expect(newLogin.data.user?.id).toBe(f.id);
    const [saved] = await sql`select * from profiles where id=${f.id}`;
    expect(saved!.phone).toBe("+420777555666");
    expect(saved!.phone_verified).toBe(false);
    expect(saved!.first_name).toBe("Markéta");
    expect(saved!.last_name).toBe("Opravená");
    expect(saved!.role).toBe("member");
    expect(saved!.note).toBe("Domluvit první návštěvu.");
    expect(await protectedState()).toEqual(before);
    const payload = JSON.parse(request.postData()!);
    payload[0].fullName = "Nepovolená změna";
    payload[0].email = `attacker-${f.suffix}@example.test`;
    payload[0].expected = {
      email: saved!.email,
      fullName: saved!.full_name,
      firstName: saved!.first_name,
      lastName: saved!.last_name,
      phone: saved!.phone,
    };
    for (const state of [
      undefined,
      join(process.cwd(), "tests/e2e/.auth/member.json"),
    ]) {
      const context = await browser.newContext({
        storageState: state ?? { cookies: [], origins: [] },
      });
      try {
        const result = await context.request.post(request.url(), {
          headers: {
            "next-action": request.headers()["next-action"]!,
            "content-type": "text/plain;charset=UTF-8",
            origin: new URL(request.url()).origin,
          },
          data: JSON.stringify(payload),
        });
        expect(await result.text()).toContain("Nemáte oprávnění");
      } finally {
        await context.close();
      }
    }
    expect((await sql`select * from profiles where id=${f.id}`)[0]).toEqual(
      saved,
    );
    expect(await protectedState()).toEqual(before);
    await page
      .getByRole("button", { name: "Upravit údaje", exact: true })
      .click();
    await expect(dialog.getByLabel("E-mail", { exact: true })).toHaveValue(
      corrected,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    const customer = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const account = await customer.newPage();
      await account.goto("/login");
      await account.getByLabel("E-mail", { exact: true }).fill(corrected);
      await account.getByLabel("Heslo", { exact: true }).fill(f.password);
      await account
        .getByRole("button", { name: "Přihlásit", exact: true })
        .click();
      await expect(account).toHaveURL(/\/account$/);
      await expect(
        account.getByText("Markéta Opravená", { exact: true }).first(),
      ).toBeVisible();
      await account.goto("/account?tab=profile");
      await expect(
        account.getByLabel("Jméno pro doklady", { exact: true }),
      ).toHaveValue("Markéta");
      await expect(
        account.getByLabel("Příjmení pro doklady", { exact: true }),
      ).toHaveValue("Opravená");
    } finally {
      await customer.close();
    }
    expect(await protectedState()).toEqual(before);
  } finally {
    await cleanup(f.id);
  }
});

test("calendar events link the actual member, preserve note interaction and keyboard navigation, and disable navigation while selecting blocks", async ({
  page,
}) => {
  const f = await fixture(page);
  let guestId: string | undefined;
  try {
    const guestStart = new Date(f.free[1].startISO),
      guestEnd = new Date(guestStart.getTime() + 75 * 60000);
    const [guest] =
      await sql`insert into reservation(starts_at,ends_at,status,price_cents,contact_name,contact_email) values(${guestStart},${guestEnd},'confirmed',23900,'Host bez účtu','guest-contact@example.test') returning id`;
    guestId = guest!.id;
    const pendingStart = new Date(f.free[2].startISO),
      pendingEnd = new Date(pendingStart.getTime() + 75 * 60000);
    await sql`update reservation set reschedule_starts_at=${pendingStart},reschedule_ends_at=${pendingEnd} where id=${f.bookingId}`;
    const before = await protectedState();
    await openCalendarTomorrow(page, f.day);
    const links = page.locator(`a.fc-event[href="/admin/members/${f.id}"]`);
    await expect(links).toHaveCount(2);
    const note = page
      .getByRole("button", {
        name: "Poznámka k zákazníkovi Markéta Testová",
        exact: true,
      })
      .first();
    await note.scrollIntoViewIfNeeded();
    await note.click();
    await expect(page.getByRole("tooltip")).toHaveText(
      "Domluvit první návštěvu.",
    );
    await expect(page).toHaveURL(/\/admin\/calendar$/);
    await page.keyboard.press("Escape");
    await links.first().focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/admin/members/${f.id}$`));
    await openCalendarTomorrow(page, f.day);
    await page
      .getByRole("button", {
        name: "Vybrat termíny k zablokování",
        exact: true,
      })
      .click();
    await expect(links).toHaveCount(0);
    await page
      .locator(".fc-event")
      .filter({ hasText: "Markéta Testová" })
      .first()
      .click({ position: { x: 3, y: 3 } });
    await expect(page).toHaveURL(/\/admin\/calendar$/);
    await page
      .getByRole("button", { name: "Zrušit výběr", exact: true })
      .click();
    await expect(links).toHaveCount(2);
    const guestLink = page.locator(
      `a.fc-event[href="/admin/reservations?id=${guestId}"]`,
    );
    await expect(guestLink).toHaveCount(1);
    await guestLink.click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/reservations\\?id=${guestId}$`),
    );
    expect(await protectedState()).toEqual(before);
  } finally {
    await cleanup(f.id, guestId ? [guestId] : []);
  }
});
