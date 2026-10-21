import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { join } from "node:path";

/** Called only by the isolated local E2E runner, never against production. */
export async function captureContentPreviews(baseURL: string, runId: string) {
  const url = new URL(baseURL);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || !runId)
    throw new Error("Screenshots require the disposable local test server.");
  const response = await fetch(`${baseURL}/login`);
  if (response.headers.get("x-navi-test-run") !== runId)
    throw new Error("The screenshot server does not match this isolated run.");
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1000 },
      reducedMotion: "reduce",
    });
    const directory = join(process.cwd(), "public/images/content-previews");
    await mkdir(directory, { recursive: true });
    for (const [id, route, selector] of [
      ["hero", "/", "main > section:first-child"],
      ["opening", "/", "aside[aria-label='Otevření a akční vstupné']"],
      ["facts", "/", "#informace"],
      ["steps", "/", "#jak-to-funguje"],
      ["pricing", "/", "#cenik"],
      ["gallery", "/", "#prostor"],
      ["contact", "/", "#kontakt"],
      ["newsletter", "/", "#novinky"],
      ["equipment", "/vybaveni", "main"],
      ["faq", "/faq", "main"],
      ["rules", "/provozni-rad", "main"],
    ]) {
      await page.goto(`${baseURL}${route}`, { waitUntil: "domcontentloaded" });
      // Screenshots document content, not the visitor's consent dialog.
      await page.addStyleTag({
        content:
          '[data-testid="tracking-consent"] { display: none !important; }',
      });
      let element = page.locator(selector!);
      if (!(await element.count()) && id === "opening") {
        // The date-limited announcement is absent after 2026. The layout
        // reference remains reproducible using its known fixture copy.
        await page.locator("main > section:first-child").evaluate((parent) => {
          const aside = document.createElement("aside");
          aside.id = "opening-fixture";
          aside.className =
            "bg-gold px-4 py-3 text-center text-gold-foreground";
          aside.innerHTML =
            '<strong>MÁME OTEVŘENO • VSTUP 199 Kč PO CELÝ ŘÍJEN</strong><p class="mt-1 text-xs">Zarezervuj si svůj termín již teď.</p>';
          parent.append(aside);
        });
        element = page.locator("#opening-fixture");
      }
      await element.scrollIntoViewIfNeeded();
      await element.evaluate(async (target) => {
        await document.fonts.ready;
        await Promise.race([
          Promise.all(
            [...target.querySelectorAll("img")].map((image) =>
              image.decode().catch(() => {}),
            ),
          ),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
      });
      const screenshot = await element.screenshot({ animations: "disabled" });
      const metadata = await sharp(screenshot).metadata();
      await sharp(screenshot)
        .extract({
          left: 0,
          top: 0,
          width: metadata.width!,
          height: Math.min(metadata.height!, 900),
        })
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toFile(join(directory, `${id}.webp`));
    }
  } finally {
    await browser.close();
  }
}
