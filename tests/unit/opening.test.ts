import assert from "node:assert/strict";
import test from "node:test";
import { openingAnnouncement, resolveAnnouncement, announcementSchema } from "../../src/lib/config/opening";

test("opening banner follows Prague dates and expires after December", () => {
  assert.match(
    openingAnnouncement(new Date("2026-09-30T21:59:59Z"))!,
    /OTEVÍRÁME/,
  );
  assert.match(
    openingAnnouncement(new Date("2026-09-30T22:00:00Z"))!,
    /MÁME OTEVŘENO/,
  );
  assert.match(openingAnnouncement(new Date("2026-10-31T22:59:59Z"))!, /199/);
  assert.match(openingAnnouncement(new Date("2026-10-31T23:00:00Z"))!, /229/);
  assert.equal(openingAnnouncement(new Date("2026-12-31T23:00:00Z")), null);
});

test("saved single announcement persists independently of the old calendar phases", () => {
  const copy = { before: "Dříve", october: "Nyní", yearEnd: "Později", cta: "Druhý řádek" };
  const saved = { enabled: true, title: "Vlastní oznámení", showSecondLine: false, secondLine: "Uložený text" };
  for (const date of ["2026-09-01", "2026-10-21", "2026-11-01", "2027-03-01"])
    assert.deepEqual(resolveAnnouncement(saved, new Date(date), copy), saved);
  assert.deepEqual(resolveAnnouncement({ ...saved, enabled: false }, new Date("2027-01-01"), copy), { ...saved, enabled: false });
});

test("unconfigured announcement preserves edited legacy copy without writing or reactivating an expired banner", () => {
  const copy = { before: "Dříve", october: "Nyní", yearEnd: "Později", cta: "Výzva" };
  const current = resolveAnnouncement(undefined, new Date("2026-10-21"), copy);
  assert.deepEqual(current, { enabled: true, title: "Nyní", showSecondLine: true, secondLine: "Výzva" });
  assert.equal(resolveAnnouncement(null, new Date("2027-01-01"), copy).enabled, false);
  assert.deepEqual(resolveAnnouncement({ enabled: "false" }, new Date("2026-10-21"), copy), current);
});

test("announcement input validates real booleans, keeps optional empty second text and trims text", () => {
  const value = { enabled: false, title: "  Text  ", showSecondLine: false, secondLine: " " };
  assert.deepEqual(announcementSchema.parse(value), { ...value, title: "Text", secondLine: "" });
  for (const patch of [{ title: " " }, { enabled: "false" }, { title: "a".repeat(501) }, { secondLine: "a".repeat(1001) }])
    assert.equal(announcementSchema.safeParse({ ...value, ...patch }).success, false);
});

test("editable announcement copy keeps the original phase boundaries", () => {
  const copy = {
    before: "Před otevřením",
    october: "Říjnové oznámení",
    yearEnd: "Závěr roku",
  };
  assert.equal(
    openingAnnouncement(new Date("2026-10-31T22:59:59Z"), copy),
    copy.october,
  );
  assert.equal(
    openingAnnouncement(new Date("2026-10-31T23:00:00Z"), copy),
    copy.yearEnd,
  );
  assert.equal(
    openingAnnouncement(new Date("2026-12-31T23:00:00Z"), copy),
    null,
  );
});
