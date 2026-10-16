import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  dayOfWeek,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
test.afterAll(async () => {
  await sql.end({ timeout: 2 });
});

test("admin edits templates in dialogs and applies/undoes batches without changing customers, codes or sending messages", async ({
  page,
  browser,
}) => {
  const today = dateKeyInTimeZone(new Date());
  let target = addDaysToDateKey(today, 2);
  while (dayOfWeek(localDateTimeToDate(target, 720)) !== 6)
    target = addDaysToDateKey(target, 1);
  const prefix = `Blocking-${randomUUID()}`;
  const bookings = await sql`select * from reservation order by id`,
    codes = await sql`select * from access_code order by id`;
  const [emails] = await sql`select count(*)::int as n from email_archive`;
  let templateId: string | undefined, applicationId: string | undefined;
  try {
    await page.goto("/admin/blocking");
    await expect(
      page.getByRole("heading", { name: "Blokování termínů", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Přidat šablonu", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Název šablony").fill(prefix);
    await dialog
      .getByRole("group", { name: "Sobota", exact: true })
      .getByRole("button", { name: "05:00–06:15", exact: true })
      .click();
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getComputedTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    expect(
      (await new AxeBuilder({ page }).include("dialog").analyze()).violations,
    ).toEqual([]);
    await dialog
      .getByRole("button", { name: "Uložit šablonu", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const [template] =
      await sql`select id from block_template where name=${prefix}`;
    templateId = template!.id;
    // Card primitive has no test-only selectors; use its heading's nearest card.
    const templateCard = page
      .getByRole("heading", { name: prefix, exact: true })
      .locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
    await templateCard
      .getByRole("button", { name: "Použít", exact: true })
      .click();
    await dialog.getByLabel("Od (včetně)").fill(target);
    await dialog.getByLabel("Do (včetně)").fill(target);
    await dialog
      .getByRole("button", { name: "Zobrazit náhled", exact: true })
      .click();
    await expect(
      dialog.getByText("Připraveno 1 blokací", { exact: true }),
    ).toBeVisible();
    let lostResponse = false;
    await page.route("**/admin/blocking**", async (route) => {
      if (route.request().method() !== "POST" || lostResponse)
        return route.continue();
      lostResponse = true;
      await route.fetch();
      await route.abort("connectionreset");
    });
    await dialog
      .getByRole("button", { name: "Zablokovat 1 slotů", exact: true })
      .click();
    await expect(
      dialog.getByText(/Výsledek uložení se nepodařilo načíst/),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Ověřit uložení", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    const [batch] =
      await sql`select id from block_application where snapshot->'templates' @> ${sql.json([{ id: templateId }])}`;
    applicationId = batch!.id;
    const guest = await browser.newContext();
    const publicPage = await guest.newPage();
    await publicPage.goto(`/rezervace?date=${target}`);
    await expect(
      publicPage.getByRole("button", { name: /0?5:00.*Obsazeno/ }),
    ).toBeDisabled();
    await guest.close();
    await page
      .getByRole("button", { name: "Zrušit budoucí blokace", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Zrušit budoucí blokace", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(
      (
        await sql`select * from blocked_slot where application_id=${applicationId!}`
      ).length,
    ).toBe(0);
    expect(await sql`select * from reservation order by id`).toEqual(bookings);
    expect(await sql`select * from access_code order by id`).toEqual(codes);
    expect(
      (await sql`select count(*)::int as n from email_archive`)[0]!.n,
    ).toBe(emails!.n);
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Přidat šablonu", exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await dialog
      .getByRole("button", { name: "Zavřít dialog", exact: true })
      .click();
  } finally {
    if (applicationId) {
      await sql`delete from blocked_slot where application_id=${applicationId!}`;
      await sql`delete from block_application where id=${applicationId}`;
    }
    if (templateId)
      await sql`delete from block_template where id=${templateId}`;
  }
});

test("evening email template and threshold are editable without sending a test message", async ({
  page,
}) => {
  const [emails] = await sql`select count(*)::int as n from email_archive`;
  await page.goto("/admin/emails");
  await page
    .getByLabel("Od jakého času posílat vstupní kód s večerním upozorněním")
    .fill("21:30");
  await page.getByRole("button", { name: "Uložit čas", exact: true }).click();
  await expect(
    page.getByText("Čas odesílání uložen.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel(
      "Od jakého času posílat vstupní kód s večerním upozorněním",
    ),
  ).toHaveValue("21:30");
  // Restore local default for the other browser scenarios.
  await page
    .getByLabel("Od jakého času posílat vstupní kód s večerním upozorněním")
    .fill("21:00");
  await page.getByRole("button", { name: "Uložit čas", exact: true }).click();
  await expect(
    page.getByText("Čas odesílání uložen.", { exact: true }),
  ).toBeVisible();
  expect((await sql`select count(*)::int as n from email_archive`)[0]!.n).toBe(
    emails!.n,
  );
});
