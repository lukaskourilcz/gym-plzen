/**
 * The machine-to-machine entry points refuse anyone without their secret:
 * a forged payment notification must never confirm a booking, and the
 * watchdog (which provisions door codes) must not run for a stranger.
 */
import {
  databaseReady,
  resetDatabase,
  rows,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

process.env.CRON_SECRET = "test-cron-secret";

describe(
  "route authentication",
  { skip: !databaseReady && "needs a local TEST_DATABASE_URL" },
  () => {
    before(async () => {
      await startProviders();
    });
    after(async () => {
      await stopEverything();
    });
    beforeEach(async () => {
      await resetDatabase();
    });

    test("a Comgate notification with a wrong secret is refused and changes nothing", async () => {
      const { POST } = await import("../../src/app/api/webhooks/comgate/route");
      const before = await rows("select * from webhook_event");
      const forged = new URLSearchParams({
        merchant: "test-merchant",
        test: "true",
        price: "22900",
        curr: "CZK",
        label: "NAVI Private Gym",
        refId: "00000000-0000-4000-8000-000000000000",
        email: "utocnik@example.test",
        transId: "FAKE-0001",
        status: "PAID",
        secret: "not-the-secret",
      });
      const response = await POST(
        new Request("http://localhost/api/webhooks/comgate", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: forged.toString(),
        }) as never,
      );
      assert.equal(response.status, 403);
      assert.deepEqual(await rows("select * from webhook_event"), before);
    });

    test("a genuine notification for an unknown payment is not acknowledged", async () => {
      const { POST } = await import("../../src/app/api/webhooks/comgate/route");
      const response = await POST(
        new Request("http://localhost/api/webhooks/comgate", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            merchant: "test-merchant",
            test: "true",
            price: "22900",
            curr: "CZK",
            label: "NAVI Private Gym",
            refId: "00000000-0000-4000-8000-000000000000",
            email: "zakaznik@example.test",
            transId: "UNKNOWN-0001",
            status: "PAID",
            secret: "test-secret",
          }).toString(),
        }) as never,
      );
      // 503 makes Comgate retry once the payment row exists; never a 200.
      assert.equal(response.status, 503);
    });

    test("the watchdog refuses a request without the cron secret", async () => {
      const { GET } = await import("../../src/app/api/cron/watchdog/route");
      const anonymous = await GET(
        new Request("http://localhost/api/cron/watchdog") as never,
      );
      assert.equal(anonymous.status, 401);
      const wrong = await GET(
        new Request("http://localhost/api/cron/watchdog", {
          headers: { authorization: "Bearer guess" },
        }) as never,
      );
      assert.equal(wrong.status, 401);
      const right = await GET(
        new Request("http://localhost/api/cron/watchdog", {
          headers: { authorization: "Bearer test-cron-secret" },
        }) as never,
      );
      assert.equal(right.status, 200);
    });
  },
);
