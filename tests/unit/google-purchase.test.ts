import assert from "node:assert/strict";
import { test } from "node:test";
process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = "G-TEST";
const { trackGooglePurchase } =
  await import("../../src/lib/analytics/google-analytics");
const { CONSENT_STORAGE_KEY } = await import("../../src/lib/config/analytics");
test("GA purchase requires analytics consent, excludes free bookings and deduplicates transaction", () => {
  const local = new Map<string, string>(),
    session = new Map<string, string>();
  const commands: unknown[][] = [];
  Object.assign(globalThis, {
    window: {
      localStorage: { getItem: (k: string) => local.get(k) ?? null },
      sessionStorage: {
        getItem: (k: string) => session.get(k) ?? null,
        setItem: (k: string, v: string) => session.set(k, v),
      },
      gtag: (...args: unknown[]) => commands.push(args),
    },
    document: { getElementById: () => ({}) },
  });
  trackGooglePurchase("booking", 398, "czk");
  assert.equal(commands.length, 0);
  local.set(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ analytics: false, marketing: true }),
  );
  trackGooglePurchase("booking", 398, "czk");
  assert.equal(commands.length, 0);
  local.set(
    CONSENT_STORAGE_KEY,
    JSON.stringify({ analytics: true, marketing: false }),
  );
  trackGooglePurchase("free", 0, "czk");
  assert.equal(commands.length, 0);
  trackGooglePurchase("booking", 398, "czk");
  trackGooglePurchase("booking", 398, "czk");
  const events = commands.filter((c) => c[0] === "event");
  assert.equal(events.length, 1);
  assert.deepEqual(events[0]?.slice(0, 2), ["event", "purchase"]);
  assert.equal((events[0]?.[2] as { value: number }).value, 3.98);
  assert.equal(
    (events[0]?.[2] as { transaction_id: string }).transaction_id,
    "booking",
  );
});
