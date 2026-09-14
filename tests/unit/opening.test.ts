import assert from "node:assert/strict";
import test from "node:test";
import { openingAnnouncement } from "../../src/lib/config/opening";

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
