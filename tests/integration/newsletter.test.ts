/**
 * Newsletter consent can be withdrawn (GDPR art. 7(3)): the personal link
 * unsubscribes exactly its own address, a forged or foreign token changes
 * nothing, and the withdrawal is logged.
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

process.env.ACCESS_CODE_ENCRYPTION_KEY ??= "a".repeat(64);

describe(
  "newsletter unsubscribe",
  { skip: !databaseReady && "needs a local TEST_DATABASE_URL" },
  () => {
    before(async () => {
      await startProviders();
      await rows("delete from newsletter_subscriber");
    });
    after(async () => {
      await rows("delete from newsletter_subscriber");
      await stopEverything();
    });
    beforeEach(async () => {
      await resetDatabase();
      await rows("delete from newsletter_subscriber");
    });

    test("the personal link unsubscribes its own address only, and is logged", async () => {
      const newsletter = await import("../../src/lib/services/newsletter");
      const { unsubscribeNewsletterAction } =
        await import("../../src/app/newsletter/actions");
      await newsletter.subscribe("Anna@Example.test");
      await newsletter.subscribe("bara@example.test");
      const url = new URL(newsletter.unsubscribeUrl("anna@example.test")!);
      assert.equal(url.pathname, "/newsletter/odhlaseni");
      const token = url.searchParams.get("t")!;

      // Anna's token proves nothing about Bára.
      const foreign = await unsubscribeNewsletterAction({
        email: "bara@example.test",
        token,
      });
      assert.equal(foreign.ok, false);
      const forged = await unsubscribeNewsletterAction({
        email: "anna@example.test",
        token: "x".repeat(32),
      });
      assert.equal(forged.ok, false);

      const ok = await unsubscribeNewsletterAction({
        email: "ANNA@example.test",
        token,
      });
      assert.equal(ok.ok, true);
      const status = await rows<{ email: string; status: string }>(
        "select email, status from newsletter_subscriber order by email",
      );
      assert.deepEqual(
        status.map((row) => [row.email, row.status]),
        [
          ["anna@example.test", "unsubscribed"],
          ["bara@example.test", "subscribed"],
        ],
      );
      const log = await rows<{ action: string }>(
        "select action from activity_log where action = 'newsletter.unsubscribed'",
      );
      assert.equal(log.length, 1);
    });
  },
);
