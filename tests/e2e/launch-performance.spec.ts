import { test, expect } from "@playwright/test";
import { join } from "node:path";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";

test("local launch timing, transferred bytes and route transitions (#173)", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const samples: object[] = [];
  const detailsRoute = `/rezervace/udaje?start=${encodeURIComponent(localDateTimeToDate(addDaysToDateKey(dateKeyInTimeZone(new Date()), 7), 300).toISOString())}`;
  for (const width of [390, 1280]) {
    for (const [state, route] of [
      [null, "/"],
      [null, "/rezervace"],
      [null, detailsRoute],
      ["member", "/account"],
      ["admin", "/admin"],
      ["admin", "/admin/calendar"],
      ["admin", "/admin/finance"],
    ] as const) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        ...(state
          ? {
              storageState: join(
                process.cwd(),
                "tests",
                "e2e",
                ".auth",
                `${state}.json`,
              ),
            }
          : {}),
      });
      try {
        await context.route("**/*", (request) =>
          ["localhost", "127.0.0.1"].includes(
            new URL(request.request().url()).hostname,
          )
            ? request.continue()
            : request.abort(),
        );
        const page = await context.newPage();
        await page.addInitScript(() => {
          const metrics = { lcp: 0, cls: 0, interaction: 0 };
          Object.assign(window, { launchMetrics: metrics });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              metrics.lcp = entry.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & {
                hadRecentInput: boolean;
                value: number;
              };
              if (!shift.hadRecentInput) metrics.cls += shift.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries())
              metrics.interaction = Math.max(
                metrics.interaction,
                entry.duration,
              );
          }).observe({
            type: "event",
            buffered: true,
            durationThreshold: 16,
          } as PerformanceObserverInit);
        });
        let currentRoute: string = route;
        for (const cache of ["cold-browser", "warm-browser"] as const) {
          const response =
            cache === "cold-browser"
              ? await page.goto(
                  `http://localhost:${process.env.E2E_PORT ?? "3131"}${currentRoute}`,
                )
              : await page.reload();
          expect(response?.status()).toBe(200);
          await expect(page.locator("#main-content")).toBeVisible();
          await expect(page.locator("#main-content h1").first()).toBeVisible();
          await expect(page).toHaveTitle(/\S/);
          await page.waitForLoadState("networkidle");
          const measured = await page.evaluate(() => {
            const navigation = performance.getEntriesByType(
              "navigation",
            )[0] as PerformanceNavigationTiming;
            const resources = performance.getEntriesByType(
              "resource",
            ) as PerformanceResourceTiming[];
            const bytes = (type: string) =>
              resources
                .filter((resource) => resource.name.includes(type))
                .reduce(
                  (total, resource) => total + resource.encodedBodySize,
                  0,
                );
            return {
              ttfb: Math.round(
                navigation.responseStart - navigation.requestStart,
              ),
              documentBytes: navigation.encodedBodySize,
              jsBytes: bytes(".js"),
              cssBytes: bytes(".css"),
              requests: resources.length,
              ...(window as unknown as { launchMetrics: object }).launchMetrics,
              waterfall: resources.map(
                ({ name, startTime, duration, encodedBodySize }) => ({
                  path: new URL(name).pathname,
                  start: Math.round(startTime),
                  ms: Math.round(duration),
                  bytes: encodedBodySize,
                }),
              ),
            };
          });
          samples.push({
            width,
            route: currentRoute.split("?")[0],
            cache,
            ...measured,
          });
        }
        if (route === "/rezervace") {
          const consent = page.getByRole("button", { name: "Pouze nezbytné" });
          if (await consent.isVisible()) await consent.click();
          await page
            .getByRole("button", { name: /Vybrat$/ })
            .last()
            .click();
          const at = performance.now();
          await page
            .getByRole("region", { name: "Vybrané termíny" })
            .getByRole("link", { name: /Pokračovat/ })
            .click();
          await expect(page).toHaveURL(/\/rezervace\/udaje\?start=/);
          await expect(
            page.getByLabel("E-mail", { exact: true }),
          ).toBeVisible();
          await expect(page).toHaveTitle(/\S/);
          await page.waitForLoadState("networkidle");
          currentRoute = new URL(page.url()).pathname;
          samples.push({
            width,
            route: currentRoute,
            transitionMs: Math.round(performance.now() - at),
            ...(await page.evaluate(() => ({
              ...(window as unknown as { launchMetrics: object }).launchMetrics,
              rscBytes: (
                performance.getEntriesByType(
                  "resource",
                ) as PerformanceResourceTiming[]
              )
                .filter((item) => item.name.includes("_rsc="))
                .reduce((n, item) => n + item.encodedBodySize, 0),
            }))),
          });
          await page.screenshot({
            path: test.info().outputPath(`details-${width}.png`),
            fullPage: true,
          });
        }
        if (route === "/")
          await page.screenshot({
            path: test.info().outputPath(`home-${width}.png`),
            fullPage: true,
          });
      } finally {
        await context.close();
      }
    }
  }
  const body = JSON.stringify(
    {
      conditions:
        "loopback PostgreSQL and provider fixtures, Chromium, no CPU/network throttling; LCP/CLS lab samples and observed event durations, not field INP",
      samples,
    },
    null,
    2,
  );
  await test.info().attach("launch-performance.json", {
    body,
    contentType: "application/json",
  });
  console.log(`LAUNCH_METRICS ${body}`);
});
