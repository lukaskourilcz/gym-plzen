import {
  databaseReady,
  resetDatabase,
  rows,
  setSetting,
  startProviders,
  stopEverything,
  resend,
} from "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { env } from "../../src/lib/env";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import { initPipeline, dueForRetry } from "../../src/lib/services/pipeline";
import { cancelReservation } from "../../src/lib/services/reservations";
import { reconcileRevocations } from "../../src/lib/services/access-codes";
import { checkAvailability } from "../../src/lib/services/availability";
import { decryptPin } from "../../src/lib/helpers/pin-vault";

const nativeFetch = globalThis.fetch;
let online = true,
  putCount = 0,
  mode: "ok" | "lost" | "rejected" | "pending" = "ok",
  deleteWorks = true;
let auths: Array<Record<string, unknown>> = [];
const key = "ab".repeat(32);
const now = new Date("2030-10-01T10:00:00Z");
async function booking(minutes = 30) {
  const [r] = await rows<{ id: string }>(
    `insert into reservation(starts_at,ends_at,status,contact_email,price_cents)
    values ($1,$2,'confirmed','entry@example.test',19900) returning id`,
    [
      new Date(now.getTime() + minutes * 60000),
      new Date(now.getTime() + (minutes + 60) * 60000),
    ],
  );
  await initPipeline(r!.id);
  return r!.id;
}
async function code(id: string) {
  return (
    await rows<{
      id: string;
      provision_state: string;
      encrypted_pin: string | null;
      status: string;
      code_hash: string;
    }>("select * from access_code where reservation_id=$1", [id])
  )[0]!;
}

describe(
  "durable access intents against isolated Postgres",
  { skip: !databaseReady },
  () => {
    before(async () => {
      env.NUKI_API_TOKEN = "test-only";
      env.NUKI_SMARTLOCK_ID = "123";
      env.ACCESS_CODE_ENCRYPTION_KEY = key;
      globalThis.fetch = async (url, options) => {
        if (!String(url).startsWith("https://api.nuki.io/"))
          return nativeFetch(url, options);
        if (options?.method === "PUT") {
          putCount++;
          if (mode === "rejected")
            return new Response("rejected", { status: 429 });
          const body = JSON.parse(String(options.body));
          auths = [
            {
              ...body,
              id: "auth-1",
              smartlockId: 123,
              enabled: true,
              ...(mode === "pending" ? { operationId: "pending" } : {}),
            },
          ];
          if (mode === "lost") throw new Error("response lost");
          return new Response(null, { status: 204 });
        }
        if (options?.method === "DELETE") {
          if (deleteWorks) auths = [];
          return new Response(null, { status: 204 });
        }
        return Response.json(
          String(url).endsWith("/auth")
            ? auths
            : { serverState: online ? 0 : 4 },
        );
      };
      await startProviders();
      await rows(
        "insert into opening_hours(day_of_week,open_minute,close_minute,slot_minutes) select n,0,1439,60 from generate_series(0,6) n on conflict(day_of_week) do nothing",
      );
    });
    after(async () => {
      globalThis.fetch = nativeFetch;
      await stopEverything();
    });
    beforeEach(async (t) => {
      if (!("mock" in t)) throw new Error("Expected test context");
      t.mock.timers.enable({ apis: ["Date"], now });
      await resetDatabase();
      await setSetting("booking.operations", {
        paymentsEnabled: true,
        bookingsFrom: "",
        accessCodesEnabled: true,
      });
      online = true;
      putCount = 0;
      auths = [];
      mode = "ok";
      deleteWorks = true;
    });
    test("48-hour booking confirms without PIN or lock request", async () => {
      const id = await booking(2880);
      await fulfillReservation(id);
      assert.equal(await code(id), undefined);
      assert.equal(putCount, 0);
      assert.ok(resend.sent.length > 0);
      assert.equal(
        (
          await rows<{ status: string }>(
            "select status from reservation where id=$1",
            [id],
          )
        )[0]?.status,
        "confirmed",
      );
    });
    test("within 24h prepares encrypted verified PIN but waits until one hour to email", async () => {
      const id = await booking(120);
      await fulfillReservation(id);
      const c = await code(id);
      assert.equal(c.provision_state, "ready");
      assert.equal(putCount, 1);
      const pin = decryptPin(
        c.encrypted_pin!,
        `access-code:${c.id}:${id}:123`,
        key,
      );
      assert.equal(pin, String(auths[0]?.code));
      assert.ok(!c.encrypted_pin!.includes(pin));
      assert.equal(
        (await rows("select * from message_delivery where kind='access_code'"))
          .length,
        0,
      );
    });
    test("long outage recovers same saved PIN after more than five failures", async () => {
      const id = await booking();
      online = false;
      for (let n = 0; n < 7; n++) await fulfillReservation(id);
      const before = await code(id);
      assert.equal(putCount, 0);
      assert.equal(before.provision_state, "prepared");
      await rows(
        "update reservation_pipeline set next_retry_at=$1 where reservation_id=$2",
        [now, id],
      );
      assert.ok((await dueForRetry()).some((s) => s.reservationId === id));
      online = true;
      await fulfillReservation(id);
      assert.equal((await code(id)).id, before.id);
      assert.equal(putCount, 1);
      assert.equal(
        (
          await rows(
            "select * from message_delivery where kind='access_code' and status='sent'",
          )
        ).length,
        1,
      );
    });
    test("lost response and duplicate fulfillment recover one authorization and one email", async () => {
      const id = await booking();
      mode = "lost";
      await Promise.all([fulfillReservation(id), fulfillReservation(id)]);
      assert.equal(putCount, 1);
      assert.equal((await code(id)).provision_state, "ready");
      assert.equal(
        (
          await rows(
            "select * from message_delivery where kind='access_code' and status='sent'",
          )
        ).length,
        1,
      );
    });
    test("accepted pending operation is only inspected, never recreated", async () => {
      const id = await booking();
      mode = "pending";
      await fulfillReservation(id);
      await fulfillReservation(id);
      assert.equal(putCount, 1);
      assert.equal((await code(id)).provision_state, "submitted");
      delete auths[0]!.operationId;
      await fulfillReservation(id);
      assert.equal(putCount, 1);
      assert.equal((await code(id)).provision_state, "ready");
    });
    test("definite rejection retries the same encrypted PIN", async () => {
      const id = await booking();
      mode = "rejected";
      await fulfillReservation(id);
      const c = await code(id);
      assert.equal(c.provision_state, "prepared");
      mode = "ok";
      await fulfillReservation(id);
      assert.equal(putCount, 2);
      assert.equal((await code(id)).id, c.id);
    });
    test("verified encrypted PIN can be emailed later while Wi-Fi is offline", async (t) => {
      const id = await booking(120);
      await fulfillReservation(id);
      const original = await code(id);
      online = false;
      t.mock.timers.setTime(now.getTime() + 61 * 60000);
      await fulfillReservation(id);
      assert.equal((await code(id)).id, original.id);
      assert.equal(putCount, 1);
      assert.equal(
        (
          await rows(
            "select * from message_delivery where kind='access_code' and status='sent'",
          )
        ).length,
        1,
      );
    });
    test("uncertain request with no visible authorization never creates a second PIN", async () => {
      const id = await booking();
      mode = "pending";
      await fulfillReservation(id);
      auths = [];
      for (let i = 0; i < 6; i++) await fulfillReservation(id);
      assert.equal(putCount, 1);
      assert.equal((await code(id)).provision_state, "submitted");
      assert.equal(
        (await rows("select * from message_delivery where kind='access_code'"))
          .length,
        0,
      );
    });
    test("email retry keeps the already verified PIN and does not recreate authorization", async (t) => {
      const id = await booking(120);
      await fulfillReservation(id);
      const c = await code(id);
      t.mock.timers.setTime(now.getTime() + 61 * 60000);
      resend.rateLimitNext(3);
      await fulfillReservation(id);
      assert.equal(putCount, 1);
      resend.rateLimitNext(0);
      await fulfillReservation(id);
      assert.equal((await code(id)).id, c.id);
      assert.equal(putCount, 1);
      assert.equal(
        (
          await rows(
            "select * from message_delivery where kind='access_code' and status='sent'",
          )
        ).length,
        1,
      );
    });
    test("offline cancellation holds slot through database constraint until confirmed deletion", async () => {
      const id = await booking();
      await fulfillReservation(id);
      online = false;
      await cancelReservation({ id });
      const [r] = await rows<{
        status: string;
        access_revocation_pending: boolean;
        starts_at: Date;
        ends_at: Date;
      }>("select * from reservation where id=$1", [id]);
      assert.equal(r!.status, "cancelled");
      assert.equal(r!.access_revocation_pending, true);
      assert.equal(
        (await checkAvailability(r!.starts_at, r!.ends_at)).available,
        false,
      );
      await assert.rejects(
        rows(
          "insert into reservation(starts_at,ends_at,status) values ($1,$2,'confirmed')",
          [r!.starts_at, r!.ends_at],
        ),
      );
      online = true;
      await rows("update access_code set retry_at=$1", [now]);
      deleteWorks = false;
      await reconcileRevocations();
      assert.equal((await code(id)).status, "scheduled");
      deleteWorks = true;
      await rows("update access_code set retry_at=$1", [now]);
      await reconcileRevocations();
      assert.equal((await code(id)).status, "revoked");
      assert.equal((await code(id)).encrypted_pin, null);
      assert.equal(
        (await checkAvailability(r!.starts_at, r!.ends_at)).available,
        true,
      );
    });
  },
);
