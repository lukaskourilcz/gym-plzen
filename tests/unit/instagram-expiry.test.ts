import assert from "node:assert/strict";
import test from "node:test";
import { instagramExpiryCountdown } from "../../src/lib/config/instagram";

const now = Date.UTC(2026, 10, 4, 15, 0);
const at = (ms: number) => new Date(now + ms).toISOString();
const minute = 60_000,
  hour = 60 * minute,
  day = 24 * hour;

test("Instagram countdown shows the two largest units with Czech plurals", () => {
  assert.deepEqual(
    instagramExpiryCountdown(at(59 * day + 23 * hour + 59 * minute), now),
    {
      tone: "ok",
      remaining: "59 dní 23 hodin",
    },
  );
  assert.equal(instagramExpiryCountdown(at(21 * day), now).remaining, "21 dní");
  assert.equal(
    instagramExpiryCountdown(at(2 * day + hour), now).remaining,
    "2 dny 1 hodina",
  );
  assert.equal(
    instagramExpiryCountdown(at(day + 4 * hour), now).remaining,
    "1 den 4 hodiny",
  );
  assert.equal(
    instagramExpiryCountdown(at(5 * hour + 2 * minute), now).remaining,
    "5 hodin 2 minuty",
  );
  assert.equal(instagramExpiryCountdown(at(hour), now).remaining, "1 hodina");
  assert.equal(
    instagramExpiryCountdown(at(21 * minute), now).remaining,
    "21 minut",
  );
  assert.equal(instagramExpiryCountdown(at(10_000), now).remaining, "1 minuta");
});

test("Instagram countdown flags the renewal window, the last days and expiry", () => {
  assert.equal(instagramExpiryCountdown(at(14 * day), now).tone, "ok");
  assert.equal(
    instagramExpiryCountdown(at(14 * day - minute), now).tone,
    "renewal",
  );
  assert.equal(instagramExpiryCountdown(at(3 * day), now).tone, "renewal");
  assert.equal(
    instagramExpiryCountdown(at(3 * day - minute), now).tone,
    "urgent",
  );
  assert.deepEqual(instagramExpiryCountdown(at(0), now), {
    tone: "expired",
    remaining: null,
  });
  assert.deepEqual(instagramExpiryCountdown(at(-day), now), {
    tone: "expired",
    remaining: null,
  });
  assert.deepEqual(instagramExpiryCountdown("not a date", now), {
    tone: "expired",
    remaining: null,
  });
});
