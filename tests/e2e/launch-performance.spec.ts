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
        const page = await context.newPage();
        // Playwright routing disables the HTTP cache. Block external HTTPS
        // providers through Chromium instead, so reload measures a warm cache.
        const network = await context.newCDPSession(page);
        await network.send("Network.enable");
        await network.send("Network.setBlockedURLs", {
          urls: ["https://*", "wss://*", "ws://*"],
        });
        await network.send("Network.setCacheDisabled", {
          cacheDisabled: false,
        });
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
          await page.waitForLoadState("load");
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            );
          });
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
            const transferred = (type: string) =>
              resources
                .filter((resource) => resource.name.includes(type))
                .reduce((total, resource) => total + resource.transferSize, 0);
            return {
              ttfb: Math.round(
                navigation.responseStart - navigation.requestStart,
              ),
              documentBytes: navigation.encodedBodySize,
              jsBytes: bytes(".js"),
              cssBytes: bytes(".css"),
              documentTransferBytes: navigation.transferSize,
              jsTransferBytes: transferred(".js"),
              cssTransferBytes: transferred(".css"),
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
          await page.waitForLoadState("load");
          await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            );
          });
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
        "loopback PostgreSQL and provider fixtures, Chromium, HTTP cache enabled, external HTTPS/WebSocket providers blocked, measurements after load/visible heading/fonts/two frames, no CPU/network throttling; LCP/CLS lab samples and observed event durations, not field INP",
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
