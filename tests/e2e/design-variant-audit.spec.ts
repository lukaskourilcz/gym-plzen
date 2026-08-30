import { test, expect, type Page } from "@playwright/test";

/**
 * Cross-variant audit. The classic look is client-approved, so the job here is
 * twofold: prove the modern variant genuinely changes, and prove the classic
 * one did not move while it was added.
 */

const WIDTHS = [320, 390, 667, 768, 1024, 1280, 1440, 1728] as const;

async function setVariant(
  page: Page,
  variant: "classic" | "modern",
  baseURL: string,
) {
  await page
    .context()
    .addCookies([{ name: "ns_design", value: variant, url: baseURL }]);
}

/**
 * Runs inside the page. Computed colours are not always `rgb()`: Tailwind's
 * opacity modifiers resolve to `oklab(...)`, which a naive numeric parse reads
 * as near-black. Painting onto a canvas makes the browser hand back sRGB bytes,
 * and `Array.from` keeps them a plain array across the serialisation boundary.
 */
function inPageColourReader() {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  return (color: string): number[] => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
  };
}

/** WCAG relative luminance from an sRGB triple. */
function luminance([r, g, b]: number[]): number {
  const [lr, lg, lb] = [r!, g!, b!].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

function contrast(foreground: number[], background: number[]): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const variant of ["classic", "modern"] as const) {
  test(`${variant}: every documented width reflows without horizontal overflow`, async ({
    page,
    baseURL,
  }) => {
    await setVariant(page, variant, baseURL!);

    for (const width of WIDTHS) {
      await page.setViewportSize({
        width,
        height: width === 667 ? 375 : width < 700 ? 760 : 900,
      });
      for (const path of ["/", "/vybaveni", "/faq"]) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
          "data-design",
          variant,
        );
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(
          overflow,
          `${path} at ${width}px in ${variant}`,
        ).toBeLessThanOrEqual(0);
      }
    }
  });
}

test("modern raises the display scale and the section rhythm", async ({
  page,
  baseURL,
}) => {
  const measure = async (variant: "classic" | "modern") => {
    await setVariant(page, variant, baseURL!);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    return page.evaluate(() => {
      const h1 = document.querySelector("h1")!;
      const section = document.querySelector("section#jak-to-funguje");
      return {
        h1: parseFloat(getComputedStyle(h1).fontSize),
        spacing: getComputedStyle(document.documentElement)
          .getPropertyValue("--section-space-lg")
          .trim(),
        sectionPadding: section
          ? parseFloat(getComputedStyle(section).paddingTop)
          : 0,
      };
    });
  };

  const classic = await measure("classic");
  const modern = await measure("modern");

  // The approved classic hero is the Tailwind 60px step at this width.
  expect(classic.h1).toBeCloseTo(60, 0);
  expect(modern.h1).toBeGreaterThan(classic.h1);
  expect(modern.h1).toBeLessThanOrEqual(72);
  expect(classic.spacing).toBe("6rem");
  expect(modern.spacing).toBe("7.5rem");
});

test("classic typography is exactly what was approved, at every step", async ({
  page,
  baseURL,
}) => {
  await setVariant(page, "classic", baseURL!);
  // The stepped scale the client signed off: 36 / 48 / 60.
  for (const [width, expected] of [
    [390, 36],
    [768, 48],
    [1280, 60],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const size = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector("h1")!).fontSize),
    );
    expect(size, `hero at ${width}px`).toBeCloseTo(expected, 0);
  }
});

test("the switch keeps AA contrast in both of its states", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const readColours = () =>
    page.evaluate((readerSource) => {
      const normalise = new Function(`return (${readerSource})()`)() as (
        c: string,
      ) => number[];
      const group = document.querySelector(
        '[data-testid="design-variant-switch"]',
      )!;
      return Array.from(group.querySelectorAll("span")).map((span) => {
        // Walk up for the first painted surface behind the label.
        let node: HTMLElement | null = span as HTMLElement;
        let background = "rgb(255, 255, 255)";
        while (node) {
          const value = getComputedStyle(node).backgroundColor;
          if (value !== "rgba(0, 0, 0, 0)" && !value.endsWith(", 0)")) {
            background = value;
            break;
          }
          node = node.parentElement;
        }
        return {
          color: normalise(getComputedStyle(span).color),
          background: normalise(background),
        };
      });
    }, inPageColourReader.toString());

  const worstContrast = async () =>
    Math.min(
      ...(await readColours()).map((pair) =>
        contrast(pair.color, pair.background),
      ),
    );

  expect(await worstContrast()).toBeGreaterThanOrEqual(4.5);

  await page
    .getByTestId("design-variant-switch")
    .first()
    .getByText("Moderní", { exact: true })
    .click();

  // Poll rather than read once: the 140ms colour transition is still running
  // immediately after the click, and interpolated colours are not the states a
  // visitor ever reads.
  await expect
    .poll(worstContrast, { timeout: 2_000 })
    .toBeGreaterThanOrEqual(4.5);
});

test("modern gold zone titles appear only where gold is legible", async ({
  page,
  baseURL,
}) => {
  await setVariant(page, "modern", baseURL!);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/vybaveni", { waitUntil: "domcontentloaded" });

  const tiles = await page.evaluate((readerSource) => {
    const normalise = new Function(`return (${readerSource})()`)() as (
      c: string,
    ) => number[];
    return Array.from(document.querySelectorAll("[data-zone]")).map((tile) => {
      const title = tile.querySelector("[data-zone-title]")!;
      return {
        zone: tile.getAttribute("data-zone"),
        colorText: getComputedStyle(title).color,
        color: normalise(getComputedStyle(title).color),
        background: normalise(getComputedStyle(tile).backgroundColor),
      };
    });
  }, inPageColourReader.toString());

  expect(tiles.length).toBeGreaterThan(0);
  for (const tile of tiles) {
    // Gold is an ink-only accent; the light tiles must not have taken it.
    if (tile.zone === "soft") {
      expect(tile.colorText).not.toBe("rgb(221, 178, 85)");
    }
    expect(
      contrast(tile.color, tile.background),
      `${tile.zone} zone title`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("reduced motion leaves the modern hover shift and ring inert", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await context.addCookies([
    { name: "ns_design", value: "modern", url: baseURL! },
  ]);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const durations = await page.evaluate(() =>
    Array.from(document.querySelectorAll("[data-cta-arrow]")).map(
      (node) => getComputedStyle(node).transitionDuration,
    ),
  );
  for (const duration of durations) {
    expect(parseFloat(duration)).toBeLessThan(0.05);
  }
  await context.close();
});

test("the switch has a visible focus indicator and survives 200% zoom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const group = page.getByTestId("design-variant-switch").first();
  await group.getByRole("radio", { name: "Klasický" }).focus();

  // The input is visually hidden, so the label must carry the indicator.
  const ring = await page.evaluate(() => {
    const label = document.querySelector(
      '[data-testid="design-variant-switch"] span',
    )!;
    const style = getComputedStyle(label);
    return {
      shadow: style.boxShadow,
      outline: style.outlineWidth,
    };
  });
  expect(
    ring.shadow !== "none" || parseFloat(ring.outline) > 0,
    "focused switch draws a visible indicator",
  ).toBe(true);

  // 200% zoom is emulated by halving the viewport at the same layout width.
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
