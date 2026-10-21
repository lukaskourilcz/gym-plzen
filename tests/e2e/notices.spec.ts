import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { BOOKING_TABLES } from "../helpers/booking-tables";
import {
  NOTICE_DEFINITIONS,
  noticeSettingKey,
  defaultPublicNotices,
} from "../../src/lib/config/public-notices";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
} from "../../src/lib/helpers/datetime";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
async function businessState() {
  const state: Record<string, unknown> = {};
  for (const table of [...BOOKING_TABLES, "email_archive"])
    state[table] = await sql.unsafe(
      `select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text), '')) as hash from public.${table} t`,
    );
  return state;
}
async function edit(page: Page, label: string, text: string) {
  await page
    .getByRole("button", { name: `Upravit: ${label}`, exact: true })
    .click();
  await page.getByRole("textbox", { name: "Text", exact: true }).fill(text);
  await page.getByRole("button", { name: "Uložit text", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("all public dialog states are editable in static, accessible previews without business writes", async ({
  page,
}) => {
  await page.goto("/admin/notices");
  const before = await businessState();
  const settings = await sql`select * from site_setting order by key`;
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  const nav = page.getByRole("navigation", { name: "Zákaznická upozornění" });
  for (const def of NOTICE_DEFINITIONS) {
    await nav.getByRole("button", { name: def.label, exact: true }).click();
    const canvas = page.getByRole("region", {
      name: `Náhled upozornění: ${def.label}`,
    });
    await canvas.locator("summary").click();
    for (const field of def.fields)
      await expect(
        canvas.getByRole("button", {
          name: `Upravit: ${field.label}`,
          exact: true,
        }),
      ).toHaveCount(1);
    await expect(canvas.locator("form, iframe, input, dialog")).toHaveCount(0);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    expect(
      await canvas.evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain("Bitter");
    await canvas
      .getByRole("button", { name: "Upravit: Nadpis", exact: true })
      .click();
    await expect(
      page.getByRole("textbox", { name: "Text", exact: true }),
    ).toBeFocused();
    expect(
      (
        await new AxeBuilder({ page })
          .include("dialog")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
  }
  expect(posts).toEqual([]);
  expect(await businessState()).toEqual(before);
  expect(await sql`select * from site_setting order by key`).toEqual(settings);
});

test("admin copy appears in real and simulated cancellations; actions align without changing existing codes or messages", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  const key = noticeSettingKey("cancellation");
  const [previous] = await sql`select * from site_setting where key=${key}`;
  const [member] =
    await sql`select id from profiles where email='member@example.test' order by created_at desc limit 1`;
  const id = randomUUID();
  await sql`insert into reservation(id,user_id,starts_at,ends_at,status,price_cents,contact_email) values(${id},${member!.id},now()+interval '3 days',now()+interval '3 days 75 minutes','confirmed',19900,'member@example.test')`;
  await sql`insert into access_code(reservation_id,code_hash,code_last2,valid_from,valid_until,status) values(${id},'synthetic-only','42',now()+interval '3 days',now()+interval '3 days 75 minutes','active')`;
  const before = await businessState();
  const otherSettings =
    await sql`select * from site_setting where key<>${key} order by key`;
  const customer = await browser.newContext({
    storageState: join(process.cwd(), "tests/e2e/.auth/member.json"),
  });
  const publicPage = await customer.newPage();
  try {
    await page.goto("/admin/notices");
    await edit(page, "Nadpis", "Opravdu chcete zrušit tento vstup?");
    await publicPage.goto("/account");
    await publicPage
      .locator(`[data-reservation-id="${id}"]`)
      .getByRole("button", { name: /Zrušit rezervaci/ })
      .click();
    const modal = publicPage.getByRole("dialog");
    await expect(
      modal.getByRole("heading", {
        name: "Opravdu chcete zrušit tento vstup?",
      }),
    ).toBeVisible();
    await expect(modal.getByText(/Zaplacených 199.*nevrací/)).toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Ponechat rezervaci" }),
    ).toBeFocused();
    for (const width of [320, 390, 1280]) {
      await publicPage.setViewportSize({ width, height: 900 });
      expect(
        await publicPage.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
      const boxes = await Promise.all(
        [
          modal.getByRole("link", { name: "Raději změnit termín" }),
          modal.getByRole("button", { name: "Ponechat rezervaci" }),
          modal.getByRole("button", { name: "Ano, zrušit bez vrácení platby" }),
        ].map((b) => b.boundingBox()),
      );
      if (width > 640) {
        expect(
          Math.max(...boxes.map((b) => b!.y)) -
            Math.min(...boxes.map((b) => b!.y)),
        ).toBeLessThan(1);
        expect(new Set(boxes.map((b) => b!.height)).size).toBe(1);
      } else
        for (const box of boxes) expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await publicPage.keyboard.press("Escape");
    const date = addDaysToDateKey(dateKeyInTimeZone(new Date()), 3);
    await page.goto(`/customer-preview?date=${date}`);
    await page
      .getByRole("button", { name: /Vybrat$/ })
      .first()
      .click();
    await page.getByRole("link", { name: /Pokračovat/ }).click();
    await page.getByLabel(/Souhlasím/).check();
    await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
    await page
      .getByRole("button", { name: "Simulovat úspěšnou platbu" })
      .click();
    await page.getByRole("button", { name: "Přejít do mého účtu" }).click();
    await page.getByRole("button", { name: /^Zrušit rezervaci / }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "Opravdu chcete zrušit tento vstup?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog").getByText(/žádný e-mail se neposílá/),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    expect(await businessState()).toEqual(before);
    expect(
      await sql`select * from site_setting where key<>${key} order by key`,
    ).toEqual(otherSettings);
  } finally {
    await page.goto("/admin/notices");
    await edit(
      page,
      "Nadpis",
      previous?.value?.title ?? defaultPublicNotices().cancellation.title!,
    );
    if (previous)
      await sql`update site_setting set value=${sql.json(previous.value)},updated_at=${previous.updated_at},updated_by_admin_id=${previous.updated_by_admin_id} where key=${key}`;
    else await sql`delete from site_setting where key=${key}`;
    await customer.close();
    await sql`delete from access_code where reservation_id=${id}`;
    await sql`delete from reservation where id=${id}`;
  }
});

test("cookie copy is public while consent stays unchanged; customer and anonymous action replay cannot edit it", async ({
  page,
  browser,
}) => {
  const key = noticeSettingKey("cookies");
  const [previous] = await sql`select * from site_setting where key=${key}`;
  const before = await businessState();
  try {
    await page.goto("/admin/notices");
    await page
      .getByRole("navigation", { name: "Zákaznická upozornění" })
      .getByRole("button", {
        name: "Nastavení soukromí (cookies)",
        exact: true,
      })
      .click();
    const request = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"],
    );
    await edit(page, "Nadpis", "Vaše soukromí na NAVI");
    const action = await request;
    const [saved] = await sql`select * from site_setting where key=${key}`;
    for (const storageState of [
      undefined,
      join(process.cwd(), "tests/e2e/.auth/member.json"),
    ]) {
      const ctx = await browser.newContext({ storageState });
      try {
        const response = await ctx.request.post(action.url(), {
          data: action.postData()!,
          headers: {
            "content-type": action.headers()["content-type"]!,
            "next-action": action.headers()["next-action"]!,
            origin: new URL(action.url()).origin,
          },
        });
        expect(await response.text()).toContain(
          "Nemáte oprávnění k této akci.",
        );
        expect(await sql`select * from site_setting where key=${key}`).toEqual([
          saved,
        ]);
        const visitor = await ctx.newPage();
        await visitor.goto("/");
        await visitor.evaluate(() =>
          window.dispatchEvent(new Event("namaste:open-cookie-settings")),
        );
        const panel = visitor.getByTestId("tracking-consent");
        await expect(
          panel.getByRole("heading", { name: "Vaše soukromí na NAVI" }),
        ).toBeVisible();
        for (const c of await panel.getByRole("checkbox").all())
          await expect(c).not.toBeChecked();
        await panel
          .getByRole("button", { name: "Pouze nezbytné", exact: true })
          .click();
        expect(
          await visitor.evaluate(() =>
            JSON.parse(localStorage.getItem("navi:tracking-consent-v2")!),
          ),
        ).toEqual({ analytics: false, marketing: false });
      } finally {
        await ctx.close();
      }
    }
    expect(await businessState()).toEqual(before);
  } finally {
    await page.goto("/admin/notices");
    await page
      .getByRole("navigation", { name: "Zákaznická upozornění" })
      .getByRole("button", {
        name: "Nastavení soukromí (cookies)",
        exact: true,
      })
      .click();
    await edit(
      page,
      "Nadpis",
      previous?.value?.title ?? defaultPublicNotices().cookies.title!,
    );
    if (previous)
      await sql`update site_setting set value=${sql.json(previous.value)},updated_at=${previous.updated_at},updated_by_admin_id=${previous.updated_by_admin_id} where key=${key}`;
    else await sql`delete from site_setting where key=${key}`;
  }
});

test("missing refund facts and interrupted save preserve text and data", async ({
  page,
}) => {
  await page.goto("/admin/notices");
  const settings = await sql`select * from site_setting order by key`;
  await page
    .getByRole("button", {
      name: "Upravit: Informace o vrácení platby",
      exact: true,
    })
    .click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Bez povinných údajů");
  await page.getByRole("button", { name: "Uložit text", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Zachovejte značky {refund_note}",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Upravit: Nadpis", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Text", exact: true })
    .fill("Rozepsaná změna");
  await page.route("**/admin/notices**", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Uložit text", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Uložení se nepodařilo potvrdit",
  );
  await expect(
    page.getByRole("textbox", { name: "Text", exact: true }),
  ).toHaveValue("Rozepsaná změna");
  await expect(
    page.getByRole("button", { name: "Uložit text", exact: true }),
  ).toBeDisabled();
  expect(await sql`select * from site_setting order by key`).toEqual(settings);
  await page.unroute("**/admin/notices**");
  await page
    .getByRole("button", { name: "Obnovit a ověřit stav", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
