import assert from "node:assert/strict";
import test from "node:test";
import { isHeroDateAllowed } from "../../src/lib/helpers/hero-availability";

test("hero dates include exactly today + 180, including across winter time and a year boundary", () => {
  const now = new Date("2026-10-24T22:30:00Z"); // October 25 in Prague
  assert.equal(isHeroDateAllowed("2026-10-24", now), false);
  assert.equal(isHeroDateAllowed("2026-10-25", now), true);
  assert.equal(isHeroDateAllowed("2027-04-23", now), true);
  assert.equal(isHeroDateAllowed("2027-04-24", now), false);
});
test("hero dates reject malformed, impossible and pre-opening dates", () => {
  const now = new Date("2026-09-23T12:00:00Z");
  for (const date of [
    "",
    "2026-10-1",
    "2026-10-32",
    "2026-11-31",
    "2026-09-30",
    "2026-10-01T00:00:00Z",
  ])
    assert.equal(isHeroDateAllowed(date, now), false);
  assert.equal(isHeroDateAllowed("2026-10-01", now), true);
  assert.equal(isHeroDateAllowed("2027-03-22", now), true);
  assert.equal(isHeroDateAllowed("2027-03-23", now), false);
});
