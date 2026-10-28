import { test, expect } from "@playwright/test";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
} from "../../src/lib/helpers/datetime";
const today = dateKeyInTimeZone(new Date());
const [year, month] = today.split("-").map(Number);
const nextMonth = new Date(Date.UTC(year!, month!, 1))
  .toISOString()
  .slice(0, 7);
const dateA = `${nextMonth}-08`,
  dateB = `${nextMonth}-10`;

test.afterEach(async ({ page }) => {
  // Neighbour prefetch may still be in a test interceptor when the page closes.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("slot toggles survive translated text nodes without removeChild failures", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/rezervace?date=${dateA}`, { waitUntil: "networkidle" });
  const initialSlot = page.getByRole("button", { name: /Vybrat$/ }).first();
  await expect(initialSlot).toBeVisible();
  const timeLabel = (await initialSlot.innerText()).split("\n")[0]!;
  const slot = page.getByRole("button").filter({ hasText: timeLabel }).first();
  // Reproduce Google Translate / native translator replacing a React-owned
  // text node. No global DOM patch or suppression of React errors is used.
  await slot.getByText("Vybrat", { exact: true }).evaluate((label) => {
    const font = document.createElement("font");
    font.textContent = "Select";
    label.replaceChildren(font);
  });
  await slot.click();
  const picked = page.getByRole("button", { name: /Vybráno$/ }).first();
  await expect(picked).toHaveAttribute("aria-pressed", "true");
  await picked.getByText("Vybráno", { exact: true }).evaluate((label) => {
    const font = document.createElement("font");
    font.textContent = "Selected";
    label.replaceChildren(font);
  });
  await slot.click();
  await expect(
    page.getByRole("button", { name: /Vybrat$/ }).first(),
  ).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
  await expect(
    page.getByRole("region", { name: "Vybrané termíny" }),
  ).toHaveCount(0);
});

test("date changes respond immediately, stale responses cannot replace the latest day and cached days avoid navigation requests", async ({
  page,
}) => {
  await page.goto(`/rezervace?date=${nextMonth}-01`, {
    waitUntil: "networkidle",
  });
  const rsc: string[] = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/rezervace") &&
      (request.headers()["rsc"] || request.isNavigationRequest())
    )
      rsc.push(request.url());
  });
  let releaseA!: () => void, releaseB!: () => void;
  let countA = 0;
  const waitingA = new Promise<void>((resolve) => {
      releaseA = resolve;
    }),
    waitingB = new Promise<void>((resolve) => {
      releaseB = resolve;
    });
  await page.route("**/api/availability/calendar?**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    const response = await route.fetch();
    if (date === dateA) {
      countA++;
      await waitingA;
    }
    if (date === dateB) await waitingB;
    await route.fulfill({ response });
  });
  const elapsed = await page.evaluate(async (date) => {
    const start = performance.now();
    document
      .querySelector<HTMLAnchorElement>(`a[data-date="${date}"]`)!
      .click();
    await new Promise(requestAnimationFrame);
    return {
      ms: performance.now() - start,
      selected: document
        .querySelector(`a[data-date="${date}"]`)
        ?.getAttribute("aria-selected"),
    };
  }, dateA);
  expect(elapsed.selected).toBe("true");
  expect(elapsed.ms).toBeLessThan(100);
  await expect(
    page.getByText("Načítám termíny…", { exact: true }),
  ).toBeVisible();
  await page.locator(`a[data-date="${dateB}"]`).click();
  releaseB();
  await expect(
    page.getByRole("button", { name: /Vybrat$/ }).first(),
  ).toBeVisible();
  const aResponse = page.waitForResponse((response) =>
    response.url().includes(`date=${dateA}`),
  );
  releaseA();
  await expect.poll(() => countA).toBe(1);
  await expect(page.locator(`a[data-date="${dateB}"]`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // Wait for A's deliberately older response to populate only the cache.
  await aResponse;
  await page.locator(`a[data-date="${dateA}"]`).click();
  await expect(
    page.getByRole("button", { name: /Vybrat$/ }).first(),
  ).toBeVisible();
  expect(countA).toBe(1);
  expect(rsc).toEqual([]);
  console.log(`Calendar input response: ${Math.round(elapsed.ms)} ms`);
});

test("lightweight errors fail closed and retry without refreshing the page", async ({
  page,
}) => {
  await page.goto(`/rezervace?date=${nextMonth}-01`, {
    waitUntil: "networkidle",
  });
  let fail = true;
  await page.route(`**/api/availability/calendar?**`, (route) =>
    new URL(route.request().url()).searchParams.get("date") === dateA && fail
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":"unavailable"}',
        })
      : route.continue(),
  );
  await page.locator(`a[data-date="${dateA}"]`).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Termíny teď nelze načíst" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Vybrat$/ })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Zkusit znovu", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Vybrat$/ }).first(),
  ).toBeVisible();
});

test("mobile multi-day selection follows browser history and realtime invalidates its public cache", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/rezervace?date=${nextMonth}-01`, {
    waitUntil: "networkidle",
  });
  const decline = page
    .getByTestId("tracking-consent")
    .getByRole("button", { name: "Pouze nezbytné" });
  if (await decline.isVisible()) await decline.click();
  await page
    .getByRole("button", { name: /Vybrat$/ })
    .first()
    .click();
  await page.locator(`a[data-date="${dateA}"]`).click();
  await page
    .getByRole("button", { name: /Vybrat$/ })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Vybrané termíny" }),
  ).toContainText("2 termíny");
  await page.goBack();
  await expect(
    page.getByRole("region", { name: "Vybrané termíny" }),
  ).toContainText("1 termín");
  await page.goForward();
  await expect(
    page.getByRole("region", { name: "Vybrané termíny" }),
  ).toContainText("2 termíny");
  const response = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/availability/calendar?`) &&
      response.url().includes(`date=${dateA}`),
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("navi:calendar-availability-change")),
  );
  await response;
  await expect(page.locator(`a[data-date="${dateA}"]`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect(addDaysToDateKey(today, 1)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
