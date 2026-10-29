import {
  addDaysToDateKey,
  dateKeyInTimeZone,
} from "../../src/lib/helpers/datetime";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { BOOKING_TABLES } from "../helpers/booking-tables";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});
async function businessState() {
  const result: Record<string, unknown> = {};
  for (const table of BOOKING_TABLES)
    result[table] = await sql.unsafe(
      `select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text), '')) as hash from public.${table} t`,
    );
  result.customers =
    await sql`select id, full_name, phone, email, role, notify_by_whatsapp from profiles where role <> 'admin' order by id`;
  return result;
}
test("customer preview is restricted to administrators", async ({
  page,
  browser,
}) => {
  await page.goto(
    "/customer-preview?screen=payment&start=2026-10-25T05:00:00Z",
  );
  await expect(page).toHaveURL(/\/login/);
  const member = await browser.newContext({
    storageState: join(process.cwd(), "tests/e2e/.auth/member.json"),
  });
  try {
    const memberPage = await member.newPage();
    await memberPage.goto("/customer-preview?screen=account");
    await expect(memberPage).toHaveURL(/\/account$/);
    await expect(memberPage.getByText("jana@preview.example.test")).toHaveCount(
      0,
    );
  } finally {
    await member.close();
  }
});
test.describe("isolated administrator walkthrough", () => {
  test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
  test("multi-slot booking, profile and simulated payment do not write business data or call providers", async ({
    page,
  }) => {
    await page.goto("/admin");
    const launch = page.getByRole("link", {
      name: "Ukázat web jako registrovaný zákazník",
    });
    await expect(launch).toHaveAttribute("href", "/customer-preview");
    await expect(launch).toHaveAttribute("target", "_blank");
    const before = await businessState();
    const dangerous: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" ||
        /comgate|resend|nuki|\/api\/availability|facebook|google-analytics|googletagmanager/.test(
          request.url(),
        )
      )
        dangerous.push(`${request.method()} ${request.url()}`);
    });
    // Always exercise the month boundary; a date in the next month is not a
    // link in the currently displayed grid. Keep both dates in the future.
    const month = addDaysToDateKey(dateKeyInTimeZone(new Date()), 2).slice(
      0,
      7,
    );
    const monthEnd = new Date(`${month}-01T12:00:00Z`);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    const firstDate = monthEnd.toISOString().slice(0, 10);
    const secondDate = addDaysToDateKey(firstDate, 1);
    await page.goto(`/customer-preview?date=${firstDate}`);
    await expect(
      page.getByRole("heading", { name: "Vyber datum a čas" }),
    ).toBeVisible();
    const freeSlots = page.getByRole("button", { name: /Vybrat$/ });
    await freeSlots.nth(0).click();
    await page
      .getByRole("link", { name: "Následující měsíc", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Vybrané termíny" }),
    ).toContainText("1 termín");
    await page.locator(`a[data-date="${secondDate}"]`).click();
    await freeSlots.nth(0).click();
    await expect(
      page.getByRole("region", { name: "Vybrané termíny" }),
    ).toContainText("2 termíny");
    await page.getByRole("link", { name: /Pokračovat/ }).click();
    await expect(
      page.getByRole("heading", { name: "Údaje a rekapitulace" }),
    ).toBeVisible();
    await expect(page.getByLabel("Jméno", { exact: true })).toHaveValue("Jana");
    if (await page.getByLabel("Přijdu sám / sama").count())
      await page.getByLabel("Přijdu sám / sama").check();
    await page.getByLabel(/Souhlasím/).check();
    await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
    await expect(
      page.getByRole("heading", { name: "Platba za rezervaci" }),
    ).toBeVisible();
    await expect(
      page.getByText("Simulace platby", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Simulovat úspěšnou platbu" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Rezervace je potvrzená" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Přejít do mého účtu" }).click();
    await expect(
      page.getByRole("heading", { name: "Ahoj, Jana" }),
    ).toBeVisible();
    await expect(page.getByText("Potvrzená", { exact: true })).toHaveCount(2);
    await expect(
      page.getByRole("region", { name: "Tvoje kredity" }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Historie kreditů", exact: true })
      .click();
    await expect(
      page.getByText("Zatím žádné kreditní pohyby.", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Profil a heslo", exact: true })
      .click();
    await page.getByLabel("Jméno", { exact: true }).fill("Petra");
    await page.getByRole("button", { name: "Uložit údaje" }).click();
    await expect(
      page.getByRole("heading", { name: "Ahoj, Petra" }),
    ).toBeVisible();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    await page
      .getByRole("link", { name: "Moje rezervace", exact: true })
      .click();
    await expect(
      page.getByRole("article", { name: /^Rezervace / }),
    ).toHaveCount(2);
    await page
      .getByRole("button", { name: /^Zrušit rezervaci / })
      .first()
      .click();
    await expect(
      page.getByRole("dialog").getByText(/Zrušíte pouze tento termín/),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Ano, zrušit/ })
      .click();
    await expect(page.getByText("Potvrzená", { exact: true })).toHaveCount(1);
    await expect(
      page.getByText("Zrušeno zákazníkem", { exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: /^Zrušit rezervaci / }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Ano, zrušit/ })
      .click();
    await expect(
      page.getByText("Nemáš žádnou naplánovanou ukázkovou rezervaci."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Začít znovu" }).click();
    await expect(
      page.getByRole("heading", { name: "Vyber datum a čas" }),
    ).toBeVisible();
    expect(dangerous).toEqual([]);
    expect(await businessState()).toEqual(before);
  });
});

test.describe("preview recap editing", () => {
  test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
  test("removing individual slots recalculates the bonus, preserves details and cannot submit an empty selection", async ({
    page,
  }) => {
    const before = await businessState();
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" ||
        /comgate|resend|nuki|\/api\/availability/.test(request.url())
      )
        writes.push(request.url());
    });
    const date = addDaysToDateKey(dateKeyInTimeZone(new Date()), 3);
    await page.goto(`/customer-preview?date=${date}`);
    for (let i = 0; i < 4; i++)
      await page
        .getByRole("button", { name: /Vybrat$/ })
        .first()
        .click();
    await page.getByRole("link", { name: /Pokračovat/ }).click();
    await expect(
      page.getByText("Bonusový 10. vstup zdarma", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: /Odebrat termín/ }),
    ).toHaveCount(4);
    await page.getByLabel("Jméno", { exact: true }).fill("Petra");
    await page
      .getByRole("button", { name: /Odebrat termín/ })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: /Odebrat termín/ }),
    ).toHaveCount(3);
    await expect(
      page.getByText("Bonusový 10. vstup zdarma", { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Jméno", { exact: true })).toHaveValue(
      "Petra",
    );
    await page.goBack();
    await expect(
      page.getByRole("button", { name: /Odebrat termín/ }),
    ).toHaveCount(4);
    await expect(
      page.getByText("Bonusový 10. vstup zdarma", { exact: true }),
    ).toHaveCount(1);
    for (let i = 0; i < 4; i++)
      await page
        .getByRole("button", { name: /Odebrat termín/ })
        .first()
        .click();
    await expect(
      page.getByText("Nejprve vyber termín v kalendáři."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Pokračovat k platbě|Potvrdit vstup/ }),
    ).toHaveCount(0);
    expect(writes).toEqual([]);
    expect(await businessState()).toEqual(before);
  });
});

test.describe("independent preview reservations", () => {
  test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
  test("changing one term and cancelling one bonus leaves the other purchased terms intact without any writes", async ({
    page,
  }) => {
    const before = await businessState();
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" ||
        /comgate|resend|nuki|\/api\/availability/.test(request.url())
      )
        writes.push(request.url());
    });
    const date = addDaysToDateKey(dateKeyInTimeZone(new Date()), 3);
    await page.goto(`/customer-preview?date=${date}`);
    for (let i = 0; i < 4; i++)
      await page
        .getByRole("button", { name: /Vybrat$/ })
        .first()
        .click();
    await page.getByRole("link", { name: /Pokračovat/ }).click();
    await expect(
      page.getByRole("heading", { name: "Údaje a rekapitulace" }),
    ).toBeVisible();
    if (await page.getByLabel("Přijdu sám / sama").count())
      await page.getByLabel("Přijdu sám / sama").check();
    await page.getByLabel(/Souhlasím/).check();
    await page.getByRole("button", { name: /Pokračovat k platbě/ }).click();
    await page
      .getByRole("button", { name: "Simulovat úspěšnou platbu" })
      .click();
    await page.getByRole("button", { name: "Přejít do mého účtu" }).click();
    const cards = page.getByRole("article", { name: /^Rezervace / });
    await expect(cards).toHaveCount(4);
    const original = await cards.evaluateAll((els) =>
      els.map((el) => ({
        id: el.getAttribute("data-reservation-id")!,
        html: el.outerHTML,
      })),
    );
    const target = page.locator(`[data-reservation-id="${original[1]!.id}"]`);
    await target
      .getByRole("button", { name: "Změnit termín", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "Původní termín platí až do dokončení změny",
    );
    await dialog.getByLabel("Nové datum").fill(addDaysToDateKey(date, 1));
    await dialog.getByRole("button", { name: /–/ }).first().click();
    await expect(dialog).toContainText("Cena zůstává");
    const a11y = await new AxeBuilder({ page })
      .include("dialog")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(a11y.violations).toEqual([]);
    await dialog
      .getByRole("button", { name: "Potvrdit změnu termínu" })
      .click();
    await expect(target).toContainText(
      "Tuto rezervaci už jste jednou změnili.",
    );
    await expect(
      target.getByRole("button", { name: "Změna termínu není dostupná" }),
    ).toBeDisabled();
    for (const index of [0, 2, 3])
      expect(
        await page
          .locator(`[data-reservation-id="${original[index]!.id}"]`)
          .evaluate((el) => el.outerHTML),
      ).toBe(original[index]!.html);
    const changed = await target.evaluate((el) => el.outerHTML);
    const bonus = cards.filter({ hasText: "Bonusový 10. vstup zdarma" });
    await bonus.getByRole("button", { name: /^Zrušit rezervaci / }).click();
    await expect(dialog).toContainText("nebyla za něj uhrazena žádná částka");
    await expect(dialog).toContainText(
      "Ostatní rezervace z objednávky zůstanou platné",
    );
    await dialog.getByRole("button", { name: "Ponechat rezervaci" }).click();
    await expect(page.getByText("Potvrzená", { exact: true })).toHaveCount(4);
    await bonus.getByRole("button", { name: /^Zrušit rezervaci / }).click();
    await dialog
      .getByRole("button", { name: "Ano, zrušit rezervaci", exact: true })
      .click();
    await expect(page.getByText("Potvrzená", { exact: true })).toHaveCount(3);
    await expect(bonus).toContainText("Zrušeno zákazníkem");
    expect(await target.evaluate((el) => el.outerHTML)).toBe(changed);
    for (const index of [0, 2])
      expect(
        await page
          .locator(`[data-reservation-id="${original[index]!.id}"]`)
          .evaluate((el) => el.outerHTML),
      ).toBe(original[index]!.html);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(1);
    }
    expect(writes).toEqual([]);
    expect(await businessState()).toEqual(before);
  });
});
