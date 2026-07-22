import assert from "node:assert/strict";
import test from "node:test";
import { isDemoAuthEnabled } from "../../src/lib/auth/demo-policy";
import { PUBLIC_AVAILABILITY_TABLE } from "../../src/lib/config/realtime";
import { safeInternalPath } from "../../src/lib/security/redirects";
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

test("log redaction hides phone numbers without corrupting timestamps", () => {
  const timestamp = "2026-07-22T20:38:57.588Z";
  assert.equal(redactForLogs(timestamp), timestamp);
  assert.equal(
    redactForLogs("Kontakt +420 777 123 456 nebo 777123456"),
    "Kontakt [redacted-phone] nebo [redacted-phone]",
  );
});
