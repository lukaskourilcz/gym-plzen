import assert from "node:assert/strict";
import test from "node:test";
import { SITE_DEFAULTS } from "../../src/lib/content/site";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  emailTextToHtml,
} from "../../src/lib/config/email-templates";
import { RESERVATION_CALENDAR_SUMMARY } from "../../src/lib/helpers/ics";

/**
 * The retired brand, in every spelling it appeared in. `namastegym.cz` is
 * deliberately excluded: the domain is a separate decision the client still
 * has to make (see NEEDED.md), and the legal texts state it as a fact.
 */
const OLD_BRAND = /namast[eé](?!gym\.cz)/i;

/**
 * Social handles name real external accounts the client owns. Renaming them
 * here would point customers at profiles that may not exist, so they stay
 * until the client confirms the new ones (see NEEDED.md).
 */
const SOCIAL_HANDLE = /namaste_plzen/i;

test("no customer-facing default still carries the old brand", () => {
  for (const [key, value] of Object.entries(SITE_DEFAULTS)) {
    const text = String(value).replace(SOCIAL_HANDLE, "");
    assert.doesNotMatch(text, OLD_BRAND, `SITE_DEFAULTS.${key}`);
  }
});

test("every e-mail template fallback is branded NAVI", () => {
  for (const definition of EMAIL_TEMPLATE_DEFINITIONS) {
    assert.doesNotMatch(definition.fallback.subject, OLD_BRAND, definition.id);
    assert.doesNotMatch(definition.fallback.body, OLD_BRAND, definition.id);
    assert.doesNotMatch(definition.label, OLD_BRAND, definition.id);
  }
  // The shared mail chrome carries the wordmark and the logo.
  const html = emailTextToHtml("Ahoj.");
  assert.doesNotMatch(html, OLD_BRAND);
  assert.match(html, /NAVI PRIVATE GYM/);
});

test("the calendar entry is branded NAVI", () => {
  assert.doesNotMatch(RESERVATION_CALENDAR_SUMMARY, OLD_BRAND);
  assert.match(RESERVATION_CALENDAR_SUMMARY, /NAVI Private Gym/);
});

test("the brand name itself is the new one", () => {
  assert.equal(SITE_DEFAULTS["brand.name"], "NAVI Private Gym");
  assert.equal(SITE_DEFAULTS["home.hero.titleAccent"], "NAVI.");
  assert.equal(SITE_DEFAULTS["contact.email"], "info@navigym.cz");
});

test("the content rebrand leaves real addresses and handles intact", async () => {
  const { rebrand } = await import("../../scripts/rebrand-navi");

  assert.equal(
    rebrand("Vítejte v NAMASTÉ Private Gym"),
    "Vítejte v NAVI Private Gym",
  );
  // Idempotent: running the migration twice must be a no-op.
  assert.equal(rebrand(rebrand("NAMASTÉ Private Gym")), "NAVI Private Gym");
  // The domain and the Instagram handle point at real places.
  assert.equal(
    rebrand("Napište na info@namastegym.cz nebo @namaste_plzen, tým NAMASTÉ."),
    "Napište na info@namastegym.cz nebo @namaste_plzen, tým NAVI.",
  );
  assert.equal(rebrand("Beze změny"), "Beze změny");
});
