import {
  databaseReady,
  resetDatabase,
  rows,
  startProviders,
  stopEverything,
} from "./setup";
import { before, after, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { env } from "../../src/lib/env";
import { raiseAlert } from "../../src/lib/services/alerts";
import { reconcileReservationWhatsApp } from "../../src/lib/services/whatsapp-delivery";

describe("WhatsApp reconciliation fairness", { skip: !databaseReady }, () => {
  const savedFetch = globalThis.fetch;
  const gets: string[] = [];
  const posts: string[] = [];
  let onGet: ((url: URL) => Promise<Response> | Response) | null = null;
  before(async () => {
    await startProviders();
    env.ZERNIO_ACCOUNT_ID = "local-account";
    env.ZERNIO_API_KEY = "local-test-only";
    globalThis.fetch = (async (input, init) => {
      const url = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      );
      if (url.hostname !== "zernio.com") return savedFetch(input, init);
      if (init?.method === "POST") posts.push(url.pathname);
      else gets.push(url.pathname);
      if (init?.method !== "POST" && onGet) return onGet(url);
      return Response.json({
        messages: [
          {
            id: "local-message",
            accountId: "local-account",
            direction: "outgoing",
            deliveryStatus: "delivered",
          },
        ],
      });
    }) as typeof fetch;
  });
  after(async () => {
    globalThis.fetch = savedFetch;
    delete env.ZERNIO_ACCOUNT_ID;
    delete env.ZERNIO_API_KEY;
    await stopEverything();
  });
  beforeEach(async () => {
    await resetDatabase();
    gets.length = 0;
    posts.length = 0;
    onGet = null;
  });

  async function seedDelivery(index: number, ambiguous: boolean) {
    const [booking] = await rows<{ id: string }>(
      `insert into reservation (starts_at, ends_at, status, price_cents, contact_email)
       values (now() + $1 * interval '1 day', now() + $1 * interval '1 day' + interval '75 minutes', 'cancelled', 0, 'whatsapp-fixture@example.test') returning id`,
      [index + 1],
    );
    const [message] = await rows<{ id: string }>(
      `insert into message_delivery (reservation_id, channel, kind, status, recipient, dedupe_key, provider_message_id, provider_response, updated_at)
       values ($1, 'whatsapp', 'access_code', $2, '+420777000111', $3, $4, $5::jsonb, now() - interval '1 hour' + $6 * interval '1 second') returning id`,
      [
        booking!.id,
        ambiguous ? "queued" : "sent",
        `zernio-access/local-${index}`,
        ambiguous ? null : "local-message",
        JSON.stringify(
          ambiguous
            ? { submitted: true, retrySafe: false }
            : {
                conversationId: `local-conversation-${index}`,
                submitted: true,
              },
        ),
        index,
      ],
    );
    return message!.id;
  }

  test("ambiguous submissions rotate past the limit without resending a PIN", async () => {
    for (let index = 0; index < 12; index++) await seedDelivery(index, true);
    const deliverable = await seedDelivery(12, false);
    await reconcileReservationWhatsApp();
    await reconcileReservationWhatsApp();
    const [row] = await rows<{ status: string }>(
      "select status from message_delivery where id = $1",
      [deliverable],
    );
    assert.equal(row?.status, "delivered");
    assert.equal(gets.length, 1);
    assert.equal(posts.length, 0, "an ambiguous send is never repeated");
  });

  test("other WhatsApp message kinds cannot consume the PIN readback limit", async () => {
    for (let index = 0; index < 10; index++)
      await rows(`insert into message_delivery (channel, kind, status, recipient, updated_at)
        values ('whatsapp', 'reservation_confirmation', 'sent', '+420777000111', now() - interval '2 hours')`);
    const deliverable = await seedDelivery(11, false);
    await reconcileReservationWhatsApp();
    const [row] = await rows<{ status: string }>(
      "select status from message_delivery where id = $1",
      [deliverable],
    );
    assert.equal(row?.status, "delivered");
    assert.equal(gets.length, 1);
    assert.equal(posts.length, 0);
  });

  test("failed readbacks rotate; a later valid PIN is not starved", async () => {
    for (let index = 0; index < 12; index++) await seedDelivery(index, false);
    const deliverable = await seedDelivery(12, false);
    onGet = (url) => {
      if (!url.pathname.includes("local-conversation-12"))
        return Response.json({ message: "temporary outage" }, { status: 503 });
      return Response.json({
        messages: [
          {
            id: "local-message",
            accountId: "local-account",
            direction: "outgoing",
            deliveryStatus: "delivered",
          },
        ],
      });
    };
    await reconcileReservationWhatsApp();
    await reconcileReservationWhatsApp();
    const [row] = await rows<{ status: string }>(
      "select status from message_delivery where id = $1",
      [deliverable],
    );
    assert.equal(row?.status, "delivered");
    assert.equal(posts.length, 0);
  });

  test("a readback for an old attempt cannot overwrite a newer WhatsApp attempt", async () => {
    const id = await seedDelivery(2, false);
    const [original] = await rows<{ reservation_id: string }>(
      "select reservation_id from message_delivery where id = $1",
      [id],
    );
    await raiseAlert({
      title: "Kontrola WhatsAppu",
      dedupeKey: `whatsapp:${original!.reservation_id}`,
    });
    onGet = async () => {
      await rows(
        "update message_delivery set provider_message_id = 'new-message', provider_response = '{\"conversationId\":\"new-conversation\",\"submitted\":true}'::jsonb, status = 'queued' where id = $1",
        [id],
      );
      return Response.json({
        messages: [
          {
            id: "local-message",
            accountId: "local-account",
            direction: "outgoing",
            deliveryStatus: "delivered",
          },
        ],
      });
    };
    await reconcileReservationWhatsApp();
    const [row] = await rows<{ status: string; provider_message_id: string }>(
      "select status, provider_message_id from message_delivery where id = $1",
      [id],
    );
    const [alert] = await rows<{ resolved_at: Date | null }>(
      "select resolved_at from system_alert where dedupe_key = $1",
      [`whatsapp:${original!.reservation_id}`],
    );
    assert.equal(row?.status, "queued");
    assert.equal(row?.provider_message_id, "new-message");
    assert.equal(alert?.resolved_at, null);
  });
});
