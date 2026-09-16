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

test("the homepage banner renders the time-aware announcement, never a literal", async () => {
  const fs = await import("node:fs/promises");
  const component = await fs.readFile(
    "src/components/site/opening-banner.tsx",
    "utf8",
  );
  assert.match(component, /openingAnnouncement\(at\)/);
  assert.match(component, /if \(!announcement\) return null/);
  assert.doesNotMatch(component, /OTEVÍRÁME 1\. 10\./);
});
