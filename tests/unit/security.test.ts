import assert from "node:assert/strict";
import test from "node:test";
import {
  isDemoAuthEnabled,
  isProductionDeployment,
  isReservedDemoEmail,
} from "../../src/lib/auth/demo-policy";
import { PUBLIC_AVAILABILITY_TABLE } from "../../src/lib/config/realtime";
import {
  postLoginDestination,
  safeInternalPath,
} from "../../src/lib/security/redirects";
import { isBookingPreviewEnabled } from "../../src/lib/config/preview";
import { redactForLogs } from "../../src/lib/helpers/logger";

test("authentication return target accepts only same-origin paths", () => {
  assert.equal(
    safeInternalPath("/rezervace?date=2026-07-22"),
    "/rezervace?date=2026-07-22",
  );
  assert.equal(safeInternalPath("https://evil.example"), "/account");
  assert.equal(safeInternalPath("//evil.example/path"), "/account");
  assert.equal(safeInternalPath("/ok\\evil"), "/account");
});

test("return targets that normalise to a protocol-relative URL are refused", () => {
  for (const crafted of [
    "/.//evil.com",
    "/%2e//evil.com",
    "/%2E//evil.com",
    "/a/..//evil.com",
    "/a/%2e%2e//evil.com",
    "/././/evil.com/path?x=1",
  ]) {
    const result = safeInternalPath(crafted);
    assert.equal(result, "/account", crafted);
    assert.ok(!result.startsWith("//"), crafted);
  }
  assert.equal(safeInternalPath("/.//evil.com", "/admin"), "/admin");
});

test("legitimate return targets keep their path, query and hash", () => {
  assert.equal(safeInternalPath("/account"), "/account");
  assert.equal(safeInternalPath("/admin/members/abc"), "/admin/members/abc");
  const order =
    "/rezervace/udaje?start=2026-10-01T05%3A00%3A00.000Z&start=2026-10-01T06%3A15%3A00.000Z";
  assert.equal(safeInternalPath(order), order);
  assert.equal(safeInternalPath("/faq#platba"), "/faq#platba");
  // A dot segment that stays on this origin still resolves normally.
  assert.equal(safeInternalPath("/a/../account"), "/account");
});

test("administrators land in the admin workspace after a default login", () => {
  assert.equal(postLoginDestination(undefined, "admin"), "/admin");
  assert.equal(postLoginDestination("/account", "admin"), "/admin");
  assert.equal(
    postLoginDestination("/rezervace?date=2026-09-05", "admin"),
    "/rezervace?date=2026-09-05",
  );
  assert.equal(postLoginDestination(undefined, "member"), "/account");
});

test("demo authentication cannot be enabled in production", () => {
  assert.equal(
    isDemoAuthEnabled({ NODE_ENV: "production", DEMO_AUTH_ENABLED: "true" }),
    false,
  );
  assert.equal(
    isDemoAuthEnabled({ NODE_ENV: "development", DEMO_AUTH_ENABLED: "true" }),
    true,
  );
  assert.equal(
    isDemoAuthEnabled({ NODE_ENV: "development", DEMO_AUTH_ENABLED: "false" }),
    false,
  );
});

test("committed demo identities are reserved away from production auth", () => {
  assert.equal(isReservedDemoEmail(" ADMIN@NAMASTE.DEMO "), true);
  assert.equal(isReservedDemoEmail("owner@navigym.cz"), false);
  assert.equal(isProductionDeployment({ VERCEL_ENV: "production" }), true);
  assert.equal(
    isProductionDeployment({
      NODE_ENV: "development",
      VERCEL_ENV: "preview",
    }),
    false,
  );
});

test("fictional availability cannot be enabled in production", () => {
  assert.equal(
    isBookingPreviewEnabled({
      NODE_ENV: "production",
      BOOKING_PREVIEW_FIXTURE: "true",
    }),
    false,
  );
  assert.equal(
    isBookingPreviewEnabled({
      NODE_ENV: "development",
      BOOKING_PREVIEW_FIXTURE: "true",
    }),
    true,
  );
});

test("public realtime subscribes only to the PII-free signal", () => {
  assert.equal(PUBLIC_AVAILABILITY_TABLE, "availability_signal");
  assert.notEqual(PUBLIC_AVAILABILITY_TABLE, "reservation");
});

test("pricing periods are private and cannot overlap", async () => {
  const source = await import("node:fs/promises").then((fs) =>
    fs.readFile("drizzle/0012_pricing_periods.sql", "utf8"),
  );
  assert.match(source, /pricing_period_no_overlap\s+EXCLUDE USING gist/i);
  assert.match(
    source,
    /ALTER TABLE public\.pricing_period ENABLE ROW LEVEL SECURITY/i,
  );
  assert.match(
    source,
    /REVOKE ALL ON public\.pricing_period FROM anon, authenticated/i,
  );
});

test("log redaction hides phone numbers without corrupting timestamps", () => {
  const timestamp = "2026-07-22T20:38:57.588Z";
  assert.equal(redactForLogs(timestamp), timestamp);
  assert.equal(
    redactForLogs("Kontakt +420 777 123 456 nebo 777123456"),
    "Kontakt [redacted-phone] nebo [redacted-phone]",
  );
  assert.equal(
    redactForLogs(
      'params: {"email":"test@example.test","code":"654 321"}, Nuki 654321',
    ),
    'params: {"email":"[redacted-email]","code":"[redacted-pin]"}, Nuki [redacted-pin]',
  );
});

test("errors reported to Sentry keep their class and stack but not the raw message", async () => {
  const { scrubError } = await import("../../src/lib/helpers/logger");
  const original = new TypeError("mail to jan.novak@example.com failed");
  const scrubbed = scrubError(original, "mail to [redacted-email] failed");
  assert.equal(scrubbed.name, "TypeError");
  assert.equal(scrubbed.message, "mail to [redacted-email] failed");
  assert.doesNotMatch(scrubbed.stack ?? "", /jan\.novak/);
  assert.match(scrubbed.stack ?? "", /security\.test/);
});
