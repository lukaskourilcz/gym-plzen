import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";
import { BOOKING_TABLES } from "../helpers/booking-tables";
const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 1 });
test.afterAll(() => sql.end({ timeout: 2 }));
test.use({ storageState: join(process.cwd(), "tests/e2e/.auth/admin.json") });
async function snapshot() {
  return Promise.all(
    BOOKING_TABLES.map((t) =>
      sql.unsafe(
        `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as data from ${t} t`,
      ),
    ),
  );
}

test("Instagram connects via local OAuth, shows lazy private thumbnails, hides posts, toggles the feed and disconnects without customer effects", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  await sql`delete from instagram_connection`;
  await sql`delete from site_setting where key='features.instagram_feed'`;
  const before = await snapshot();
  const publicPage = await page.context().newPage();
  const section = publicPage.getByRole("region", { name: "Instagram NAVI" });
  const enabled = page.getByRole("switch", {
    name: "Ukazovat Instagram na webu",
  });
  const outbound: string[] = [];
  publicPage.on("request", (r) => {
    if (
      /instagram\.com|cdninstagram\.com|fbcdn\.net/.test(
        new URL(r.url()).hostname,
      )
    )
      outbound.push(r.url());
  });
  try {
    await page.goto("/admin/content?section=instagram");
    await expect(page.getByText("Nepřipojeno", { exact: true })).toBeVisible();
    await page
      .getByRole("link", { name: "Připojit Instagram", exact: true })
      .click();
    await expect(page).toHaveURL(/section=instagram&instagram=connected/);
    await expect(
      page.getByText("Instagram je připojený.", { exact: true }),
    ).toBeVisible();
    await publicPage.goto("/#instagram");
    await section.scrollIntoViewIfNeeded();
    const links = section.getByRole("link", { name: /Otevřít příspěvek/ });
    await expect(links).toHaveCount(12);
    await expect(links.first()).toHaveAttribute(
      "href",
      "https://www.instagram.com/reel/TEST_0/",
    );
    const image = links.first().locator("img");
    await expect(image).toHaveAttribute("loading", "lazy");
    await expect
      .poll(() =>
        image.evaluate(
          (e: HTMLImageElement) => e.complete && e.naturalWidth > 0,
        ),
      )
      .toBe(true);
    expect(
      await publicPage
        .locator("#instagram")
        .evaluate(
          (e) =>
            !!(
              e.compareDocumentPosition(document.querySelector("#novinky")!) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
    ).toBe(true);
    expect(
      await publicPage
        .locator("#novinky")
        .evaluate(
          (e) =>
            !!(
              e.compareDocumentPosition(document.querySelector("#kontakt")!) &
              Node.DOCUMENT_POSITION_FOLLOWING
            ),
        ),
    ).toBe(true);
    await publicPage.setViewportSize({ width: 390, height: 844 });
    await expect(links.nth(3)).toBeVisible();
    await expect(links.nth(4)).toBeHidden();
    await section.getByRole("button", { name: "Zobrazit další" }).click();
    await expect(links.nth(11)).toBeVisible();
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page: publicPage })
      .include("#instagram")
      .analyze();
    expect(results.violations).toEqual([]);
    await page
      .getByText("Vybrat viditelné příspěvky", { exact: false })
      .click();
    const actionPromise = page.waitForRequest(
      (r) => r.method() === "POST" && !!r.headers()["next-action"],
    );
    await page
      .getByRole("button", { name: "Skrýt", exact: true })
      .first()
      .click();
    const action = await actionPromise;
    await expect(
      page.getByText("Příspěvek je skrytý.", { exact: true }),
    ).toBeVisible();
    await publicPage.reload();
    await expect(
      section.getByRole("link", { name: /Ukázkový příspěvek 1 —/ }),
    ).toHaveCount(0);
    const hiddenImage = await publicPage.request.get(
      "/api/instagram/media/100",
    );
    expect(hiddenImage.status()).toBe(404);
    const member = await browser.newContext({
      storageState: join(process.cwd(), "tests/e2e/.auth/member.json"),
    });
    const denied = await member.request.post(action.url(), {
      headers: {
        "next-action": action.headers()["next-action"]!,
        origin: new URL(action.url()).origin,
      },
      data: action.postDataBuffer()!,
    });
    expect(await denied.text()).toMatch(
      /Forbidden|přístup|oprávnění|admin|zakáz|přihl/i,
    );
    await member.close();
    const plain = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    const unauthorized = await plain.request.get(
      new URL("/api/admin/instagram/connect", page.url()).toString(),
    );
    expect(unauthorized.status()).toBe(403);
    await plain.close();
    await enabled.click();
    await expect(enabled).not.toBeChecked();
    await publicPage.reload();
    await expect(section).toHaveCount(0);
    await enabled.click();
    await expect(enabled).toBeChecked();
    await page.getByRole("button", { name: "Odpojit", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Odpojit Instagram", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await publicPage.reload();
    await expect(
      section.getByRole("link", { name: /Otevřít příspěvek/ }),
    ).toHaveCount(0);
    await expect(
      section.getByRole("link", { name: "Sleduj nás" }),
    ).toBeVisible();
    expect(outbound).toEqual([]);
    expect(await snapshot()).toEqual(before);
  } finally {
    await publicPage.close();
    await sql`delete from instagram_connection`;
    await sql`delete from site_setting where key='features.instagram_feed'`;
  }
});

test("invalid OAuth state and unauthenticated cron or deletion callbacks do not connect or sync", async ({
  page,
}) => {
  const before = await sql`select * from instagram_connection`;
  await page.goto(
    "/api/admin/instagram/callback?state=forged&code=local-test-code",
  );
  await expect(page).toHaveURL(/instagram=invalid_state/);
  expect(await sql`select * from instagram_connection`).toEqual(before);
  expect((await page.request.get("/api/cron/sync-instagram")).status()).toBe(
    401,
  );
  expect(
    (
      await page.request.post("/api/instagram/deauthorize", {
        form: { signed_request: "forged" },
      })
    ).status(),
  ).toBe(400);
});

test("signed Meta deletion callback removes only Instagram data and returns a verifiable receipt", async ({
  page,
}) => {
  const before = await snapshot();
  await page.goto("/admin/content?section=instagram");
  await page
    .getByRole("link", { name: "Připojit Instagram", exact: true })
    .click();
  await expect(page).toHaveURL(/instagram=connected/);
  const payload = Buffer.from(
    JSON.stringify({
      algorithm: "HMAC-SHA256",
      user_id: "1234",
      issued_at: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");
  const mac = createHmac("sha256", "local-instagram-secret")
    .update(payload)
    .digest("base64url");
  const result = await page.request.post("/api/instagram/deauthorize", {
    form: { signed_request: `${mac}.${payload}` },
  });
  expect(result.status()).toBe(200);
  const receipt = await result.json();
  expect(receipt.confirmation_code).toBeTruthy();
  expect((await page.request.get(receipt.url)).status()).toBe(200);
  expect(
    (
      await page.request.get("/api/instagram/deletion-status?code=forged")
    ).status(),
  ).toBe(404);
  expect(await sql`select * from instagram_connection`).toHaveLength(0);
  expect(await sql`select * from instagram_media`).toHaveLength(0);
  expect(await snapshot()).toEqual(before);
});
