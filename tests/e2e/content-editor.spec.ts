import { test, expect } from "@playwright/test";
import { join } from "node:path";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { requireTestDatabaseUrl } from "../helpers/test-database";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test("content sections show screenshots, source links, and raw dynamic placeholders", async ({
  page,
}) => {
  await page.goto("/admin/content");
  const nav = page.getByRole("navigation", { name: "Části webu" });
  await expect(
    page.getByRole("heading", { name: "Hero", exact: true }),
  ).toBeVisible();
  for (const title of [
    "Hero",
    "Vybavení",
    "Galerie",
    "Ceník a rezervace",
    "Newsletter a patička",
  ]) {
    await nav.getByRole("link", { name: title, exact: true }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    const screenshot = page.getByRole("img", {
      name: `Snímek části webu: ${title}`,
    });
    await expect(screenshot).toBeVisible();
    await expect
      .poll(() =>
        screenshot.evaluate(
          (image) => (image as HTMLImageElement).naturalWidth,
        ),
      )
      .toBeGreaterThan(0);
  }
  await nav
    .getByRole("link", { name: "Ceník a rezervace", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Otevřít Ceník a doprovod" }),
  ).toHaveAttribute("href", "/admin/memberships");
  await page
    .getByRole("button", {
      name: "Upravit: Poznámka k cenovému období",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Text: Poznámka k cenovému období" }),
  ).toHaveValue(/\{promoEndsAt\}/);
  await page.keyboard.press("Escape");
  await nav.getByRole("link", { name: "Galerie", exact: true }).click();
  await expect(
    page.getByLabel("Fotografie galerie 1", { exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
  }
});
test("public pricing card has from price without old amount, and newsletter uses informal editable copy", async ({
  page,
}) => {
  const id = randomUUID();
  const now = Date.now();
  await sql`insert into pricing_period(id,name,price_cents,starts_at,ends_at) values(${id},'Synthetic preview offer',19900,${new Date(now - 86400000)},${new Date(now + 86400000)})`;
  try {
    // ISR can hold the default initial page; invalidate only the isolated CMS.
    await page.goto("/admin/content?section=hero");
    await page.getByRole("button", { name: "Upravit: Krátký štítek" }).click();
    await page.getByRole("button", { name: "Uložit změny" }).click();
    await expect(
      page.getByText("Text je uložený a projeví se na webu."),
    ).toBeVisible();
    await page.goto("/");
    const card = page.getByTestId("pricing-card");
    await expect(card.getByText("od", { exact: true })).toBeVisible();
    await expect(card.getByText(/199\s*Kč/)).toBeVisible();
    await expect(card.locator(".line-through")).toHaveCount(0);
    await expect(
      card.getByText(/Platí i při rezervaci předem|239\s*Kč/),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: "Chceš se dozvědět novinky ze světa NAVI Private Gym jako první?",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Zanech nám svou e-mailovou adresu."),
    ).toBeVisible();
    await expect(
      page.getByText(/Odesláním souhlasíš se zpracováním/),
    ).toBeVisible();
  } finally {
    await sql`delete from pricing_period where id=${id}`;
  }
});

test("saving one gallery image changes only that setting and never bookings, codes or messages", async ({
  page,
}) => {
  const key = "branding.gallery_1_url";
  const [old] = await sql`select * from site_setting where key=${key}`;
  const others =
    await sql`select key,value from site_setting where key like 'branding.%' and key <> ${key} order by key`;
  const state = () => sql`select
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from reservation r) as bookings,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from access_code r) as codes,
    (select md5(coalesce(string_agg(to_jsonb(r)::text,'' order by id),'')) from message_delivery r) as messages`;
  const before = await state();
  try {
    await page.goto("/admin/content?section=gallery");
    const field = page.getByLabel("Fotografie galerie 1", { exact: true });
    await field.fill("/images/photos/gallery-2.webp");
    await field
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Uložit fotografii" })
      .click();
    await expect(
      page.getByText("Změna je uložená a projeví se na webu."),
    ).toBeVisible();
    expect(
      (await sql`select value from site_setting where key=${key}`)[0]?.value,
    ).toBe("/images/photos/gallery-2.webp");
    expect(
      await sql`select key,value from site_setting where key like 'branding.%' and key <> ${key} order by key`,
    ).toEqual(others);
    expect(await state()).toEqual(before);
  } finally {
    // Invalidate the isolated public cache before restoring the fixture row.
    const field = page.getByLabel("Fotografie galerie 1", { exact: true });
    await field.fill(
      typeof old?.value === "string"
        ? old.value
        : "/images/photos/gallery-1.webp",
    );
    await field
      .locator("xpath=ancestor::form")
      .getByRole("button", { name: "Uložit fotografii" })
      .click();
    await expect(
      page.getByText("Změna je uložená a projeví se na webu."),
    ).toBeVisible();
    if (old)
      await sql`update site_setting set value=${sql.json(old.value)}, updated_at=${old.updated_at}, updated_by_admin_id=${old.updated_by_admin_id} where key=${key}`;
    else await sql`delete from site_setting where key=${key}`;
  }
});
