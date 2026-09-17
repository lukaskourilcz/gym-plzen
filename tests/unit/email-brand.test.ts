import assert from "node:assert/strict";
import test from "node:test";
import {
  brandedSender,
  brandedSubject,
  EMAIL_BRAND,
} from "../../src/lib/config/email-templates";

test("every subject ends with the brand exactly once", () => {
  assert.equal(
    brandedSubject("Obnova hesla"),
    "Obnova hesla | NAVI Private Gym",
  );
  assert.equal(
    brandedSubject("Obnova hesla | NAVI Private Gym"),
    "Obnova hesla | NAVI Private Gym",
  );
  assert.equal(
    brandedSubject("  Obnova hesla |NAVI private gym  "),
    "Obnova hesla | NAVI Private Gym",
  );
  assert.equal(brandedSubject(""), EMAIL_BRAND);
});

test("the sender keeps the configured address under the brand name", () => {
  assert.equal(
    brandedSender("Namasté Private Gym <noreply@navigym.cz>"),
    "NAVI Private Gym <noreply@navigym.cz>",
  );
  assert.equal(
    brandedSender("noreply@navigym.cz"),
    "NAVI Private Gym <noreply@navigym.cz>",
  );
  assert.equal(
    brandedSender(" NAVI Private Gym <noreply@navigym.cz> "),
    "NAVI Private Gym <noreply@navigym.cz>",
  );
});
