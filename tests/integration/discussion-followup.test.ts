import {
  databaseReady,
  resetDatabase,
  rows,
  startProviders,
  stopEverything,
  resend,
} from "./setup";
import assert from "node:assert/strict";
import { before, beforeEach, after, describe, test } from "node:test";
import { cancelReservation } from "../../src/lib/services/reservations";
import { retryCancellationEmails } from "../../src/lib/services/cancellation-delivery";
import { monitorLockConnectivity } from "../../src/lib/services/lock-health";
import { env } from "../../src/lib/env";
import {
  sendTestReservationWhatsApp,
  reconcileTestWhatsApp,
} from "../../src/lib/services/whatsapp-test";
const nativeFetch = globalThis.fetch;
describe("discussion followup", { skip: !databaseReady }, () => {
  before(startProviders);
  after(stopEverything);
  beforeEach(async () => {
    globalThis.fetch = nativeFetch;
    delete env.NUKI_API_TOKEN;
    delete env.NUKI_SMARTLOCK_ID;
    await resetDatabase();
    resend.sent.length = 0;
  });
  test("ordinary cancellation queues/sends customer email exactly once and flags refund", async () => {
    const [r] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,status,contact_email,price_cents) values ('2035-10-01 10:00','2035-10-01 11:00','confirmed','test@example.test',19900) returning id",
    );
    await rows(
      "insert into payment(reservation_id,type,amount_cents,currency,status) values ($1,'one_off',19900,'CZK','succeeded')",
      [r!.id],
    );
    await cancelReservation({ id: r!.id, reason: "Test storna" });
    await cancelReservation({ id: r!.id, reason: "Test storna" });
    const messages = await rows<{ status: string }>(
      "select status from message_delivery where kind='reservation_cancellation'",
    );
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.status, "sent");
    assert.equal(
      (
        await rows(
          "select id from system_alert where dedupe_key like 'refund-needed:%'",
        )
      ).length,
      1,
    );
    assert.equal(
      resend.sent.filter((m) => JSON.stringify(m).includes("Test storna"))
        .length,
      1,
    );
  });
  test("failed cancellation email survives and is retried by watchdog", async () => {
    const [r] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,status,contact_email) values ('2035-10-02 10:00','2035-10-02 11:00','confirmed','test@example.test') returning id",
    );
    resend.rateLimitNext(2);
    await cancelReservation({ id: r!.id });
    assert.equal(
      (
        await rows<{ status: string }>(
          "select status from message_delivery where kind='reservation_cancellation'",
        )
      )[0]?.status,
      "failed",
    );
    await rows(
      "update message_delivery set updated_at=now()-interval '6 minutes' where kind='reservation_cancellation'",
    );
    await retryCancellationEmails();
    assert.equal(
      (
        await rows<{ status: string }>(
          "select status from message_delivery where kind='reservation_cancellation'",
        )
      )[0]?.status,
      "sent",
    );
  });
  test("lock outage alerts after 15 minutes, dedupes and resolves on recovery", async () => {
    env.NUKI_API_TOKEN = "test-only";
    env.NUKI_SMARTLOCK_ID = "test-health";
    await rows("delete from site_setting where key='nuki-health:test-health'");
    let online = false;
    globalThis.fetch = async (url, opts) =>
      String(url).startsWith("https://api.nuki.io/")
        ? Response.json({ serverState: online ? 0 : 4 })
        : nativeFetch(url, opts);
    const start = new Date("2030-10-01T10:00:00Z");
    await monitorLockConnectivity(start);
    assert.equal(
      (
        await rows(
          "select id from system_alert where dedupe_key='nuki-health:test-health'",
        )
      ).length,
      0,
    );
    await monitorLockConnectivity(new Date(+start + 15 * 60_000));
    await monitorLockConnectivity(new Date(+start + 20 * 60_000));
    assert.equal(
      (
        await rows(
          "select id from system_alert where dedupe_key='nuki-health:test-health'",
        )
      ).length,
      1,
    );
    online = true;
    await monitorLockConnectivity(new Date(+start + 25 * 60_000));
    assert.equal(
      (
        await rows(
          "select id from system_alert where dedupe_key='nuki-health:test-health' and resolved_at is null",
        )
      ).length,
      0,
    );
    globalThis.fetch = nativeFetch;
  });
  test("Zernio acceptance is reconciled to failure without storing PIN or billing retry", async () => {
    env.ZERNIO_API_KEY = "test";
    env.ZERNIO_ACCOUNT_ID = "account";
    env.ZERNIO_TEST_EMAIL = "test@example.test";
    env.ZERNIO_TEST_RECIPIENT = "+420737875367";
    const [r] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,status,contact_email) values ('2035-10-03 10:00','2035-10-03 11:00','confirmed','test@example.test') returning id",
    );
    let sends = 0;
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith("https://zernio.com/"))
        return nativeFetch(url, options);
      if (options?.method === "POST") {
        sends++;
        return Response.json({
          success: true,
          data: { messageId: "msg", conversationId: "conv" },
        });
      }
      return Response.json({
        messages: [
          {
            id: "msg",
            accountId: "account",
            direction: "outgoing",
            deliveryStatus: "failed",
            message: "PIN 333444",
            deliveryError: { code: 131042, message: "PIN 333444" },
          },
        ],
      });
    };
    const input = {
      reservationId: r!.id,
      accessCodeId: "test-code",
      userId: null,
      phone: "+420737875367",
      email: "test@example.test",
      pin: "333444",
      startsAt: new Date("2035-10-03T10:00Z"),
      validFrom: new Date("2035-10-03T10:00Z"),
      validUntil: new Date("2035-10-03T11:00Z"),
    };
    await sendTestReservationWhatsApp(input);
    await rows(
      "update message_delivery set updated_at=now()-interval '6 minutes' where channel='whatsapp'",
    );
    await reconcileTestWhatsApp();
    await sendTestReservationWhatsApp(input);
    const [m] = await rows<{
      status: string;
      provider_response: unknown;
      failure_reason: string;
    }>(
      "select status,provider_response,failure_reason from message_delivery where channel='whatsapp'",
    );
    assert.equal(m?.status, "failed");
    assert.equal(sends, 1);
    assert.ok(!JSON.stringify(m).includes("333444"));
    globalThis.fetch = nativeFetch;
  });
  test("ambiguous WhatsApp response never resends", async () => {
    env.ZERNIO_API_KEY = "test";
    env.ZERNIO_ACCOUNT_ID = "account";
    env.ZERNIO_TEST_EMAIL = "test@example.test";
    env.ZERNIO_TEST_RECIPIENT = "+420737875367";
    const [r] = await rows<{ id: string }>(
      "insert into reservation(starts_at,ends_at,status,contact_email) values ('2035-10-04 10:00','2035-10-04 11:00','confirmed','test@example.test') returning id",
    );
    let sends = 0;
    globalThis.fetch = async (url, options) => {
      if (!String(url).startsWith("https://zernio.com/"))
        return nativeFetch(url, options);
      sends++;
      throw new Error("lost response");
    };
    const input = {
      reservationId: r!.id,
      accessCodeId: "test-code",
      userId: null,
      phone: "+420737875367",
      email: "test@example.test",
      pin: "333444",
      startsAt: new Date("2035-10-04T10:00Z"),
      validFrom: new Date("2035-10-04T10:00Z"),
      validUntil: new Date("2035-10-04T11:00Z"),
    };
    await sendTestReservationWhatsApp(input);
    await sendTestReservationWhatsApp(input);
    assert.equal(sends, 1);
    globalThis.fetch = nativeFetch;
  });
});
