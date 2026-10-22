import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { join } from "node:path";
import postgres from "postgres";
import { CONTENT_EDITOR_SECTIONS } from "../../src/lib/content/editor";
import { randomUUID } from "node:crypto";
import { requireTestDatabaseUrl } from "../helpers/test-database";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test("all sections render editable website layouts with every text reachable on desktop and mobile", async ({
  page,
}) => {
  await page.goto("/admin/content");
  const nav = page.getByRole("navigation", { name: "Části webu" });
  for (const section of CONTENT_EDITOR_SECTIONS) {
    await nav.getByRole("link", { name: section.title, exact: true }).click();
    const canvas = page.getByRole("region", {
      name: `Upravitelné rozložení: ${section.title}`,
    });
    await expect(canvas).toBeVisible();
    // Hidden metadata (alt text, inactive campaign copy) stays reachable without
    // inventing visible public copy. Open it before checking coverage.
    for (const details of await canvas.locator("details").all())
      await details.evaluate((el) => {
        (el as HTMLDetailsElement).open = true;
      });
    for (const item of section.items) {
      await expect(
        canvas.getByRole("button", {
          name: `Upravit: ${item.label}`,
          exact: true,
        }),
      ).toHaveCount(1);
    }
    if (section.items.length)
      await canvas
        .getByRole("button", {
          name: `Upravit: ${section.items[0]!.label}`,
          exact: true,
        })
        .click();
    if (section.items.length) {
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
        section.title,
      ).toBeLessThanOrEqual(1);
    }
    // Preview does not mount any live submission form, checkout or iframe.
    await expect(
      canvas.locator("form, iframe, a[href^='mailto:']"),
    ).toHaveCount(0);
    expect(
      await canvas.evaluate((el) => getComputedStyle(el).fontFamily),
    ).toContain("Bitter");
    for (const img of await canvas.locator("img").all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() => img.evaluate((el) => (el as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
    }
  }
  await nav
    .getByRole("link", { name: "Ceník a rezervace", exact: true })
    .click();
  await page.getByText("Co se načítá odjinud", { exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Otevřít Ceník a doprovod" }),
  ).toHaveAttribute("href", "/admin/memberships");
  const campaign = page.getByRole("button", {
    name: "Upravit: Poznámka k cenovému období",
    exact: true,
  });
  if (!(await campaign.isVisible()))
    await page.getByText("Text při aktivní akci", { exact: true }).click();
  await campaign.click();
  await expect(
    page.getByRole("textbox", { name: "Text: Poznámka k cenovému období" }),
  ).toHaveValue(/\{promoEndsAt\}/);
  await page.keyboard.press("Escape");
  await expect(campaign).toBeFocused();
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
    await page
      .getByText("Mobilní fotografie a další popisky", { exact: true })
      .click();
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
    await page
      .getByRole("button", {
        name: "Upravit: Fotografie galerie 1",
        exact: true,
      })
      .click();
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
    await page.getByRole("button", { name: "Hotovo", exact: true }).click();
    await expect(
      page
        .locator('[data-content-field="home.gallery.mainImageAlt"]')
        .locator("xpath=../..")
        .locator("img"),
    ).toHaveAttribute("src", "/images/photos/gallery-2.webp");
    await page
      .getByRole("button", {
        name: "Upravit: Fotografie galerie 1",
        exact: true,
      })
      .click();
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

test("inline template edits show resolved values immediately and failures preserve the unsaved text", async ({
  page,
}) => {
  await page.goto("/admin/content?section=pricing");
  const trigger = page.getByRole("button", {
    name: "Upravit: Délka vstupu v cenové kartě",
    exact: true,
  });
  await trigger.click();
  const field = page.getByRole("textbox", {
    name: "Text: Délka vstupu v cenové kartě",
  });
  const original = await field.inputValue();
  try {
    await field.fill("Délka: {duration}");
    await page.route("**/admin/content**", async (route) => {
      if (route.request().method() === "POST") await route.abort("failed");
      else await route.continue();
    });
    await page
      .getByRole("button", { name: "Uložit změny", exact: true })
      .click();
    await expect(
      page.getByText("Uložení se nepodařilo potvrdit. Zkuste to znovu."),
    ).toBeVisible();
    await expect(field).toHaveValue("Délka: {duration}");
    await page.unroute("**/admin/content**");
    await page
      .getByRole("button", { name: "Uložit změny", exact: true })
      .click();
    await expect(
      page.getByText("Text je uložený a projeví se na webu."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Hotovo", exact: true }).click();
    await expect(
      page.locator('[data-content-field="home.pricing.duration"]'),
    ).toContainText("Délka: 75 min");
    await expect(
      page.locator('[data-content-field="home.pricing.duration"]'),
    ).not.toContainText("{duration}");
    await trigger.click();
    await expect(field).toHaveValue("Délka: {duration}");
  } finally {
    await page.unroute("**/admin/content**");
    if (!(await field.isVisible())) await trigger.click();
    await field.fill(original);
    await page
      .getByRole("button", { name: "Uložit změny", exact: true })
      .click();
    await expect(
      page.getByText("Text je uložený a projeví se na webu."),
    ).toBeVisible();
  }
});

test("visual editing controls remain accessible across all sections", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const id of [
    "hero",
    "facts",
    "steps",
    "pricing",
    "gallery",
    "equipment",
    "faq",
    "contact",
    "instagram",
    "newsletter",
    "opening",
    "rules",
  ]) {
    await page.goto(`/admin/content?section=${id}`);
    const results = await new AxeBuilder({ page })
      .include(".content-canvas")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, id).toEqual([]);
  }
});
