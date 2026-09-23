import assert from "node:assert/strict";
import test from "node:test";
import {
  isHeroDateAllowed,
  pruneHeroAvailabilityCache,
} from "../../src/lib/helpers/hero-availability";

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

test("only four initial days and already visited nearby dates remain cached", () => {
  const cache = {
    "2026-10-01": 1,
    "2026-10-02": 2,
    "2026-10-03": 3,
    "2026-10-04": 4,
    "2026-10-05": 5,
    "2026-10-17": 17,
    "2026-10-18": 18,
    "2026-10-20": 20,
    "2026-10-22": 22,
    "2026-10-23": 23,
  };
  const result = pruneHeroAvailabilityCache(cache, "2026-10-01", "2026-10-20");
  assert.deepEqual(Object.keys(result), [
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
    "2026-10-18",
    "2026-10-20",
    "2026-10-22",
  ]);
  assert.equal(result["2026-10-19"], undefined); // no neighbour prefetch
  assert.equal(result["2026-10-05"], undefined); // revisit needs a new request
  assert.equal(cache["2026-10-05"], 5); // immutable React state
  assert.equal(
    pruneHeroAvailabilityCache(result, "2026-10-01", "2026-10-20"),
    result,
  );
});

test("browsing all 180 days keeps memory bounded, including reverse navigation", () => {
  const start = "2026-10-01";
  const dateAt = (offset: number) =>
    new Date(Date.UTC(2026, 9, 1 + offset)).toISOString().slice(0, 10);
  let cache: Record<string, number> = Object.fromEntries(
    [0, 1, 2, 3].map((i) => [dateAt(i), i]),
  );
  for (const offset of [
    ...Array.from({ length: 181 }, (_, i) => i),
    ...Array.from({ length: 181 }, (_, i) => 180 - i),
  ]) {
    const selected = dateAt(offset);
    cache = pruneHeroAvailabilityCache(
      { ...cache, [selected]: offset },
      start,
      selected,
    );
    assert.ok(Object.keys(cache).length <= 9);
    assert.equal(cache[selected], offset);
    for (let i = 0; i < 4; i++) assert.equal(cache[dateAt(i)], i);
  }
  assert.deepEqual(Object.keys(cache), [
    dateAt(0),
    dateAt(1),
    dateAt(2),
    dateAt(3),
  ]);
});
