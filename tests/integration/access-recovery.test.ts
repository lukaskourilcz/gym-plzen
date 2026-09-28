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
import {
  expireEndedCodes,
  reconcileRevocations,
} from "../../src/lib/services/access-codes";
import { checkAvailability } from "../../src/lib/services/availability";
import { decryptPin } from "../../src/lib/helpers/pin-vault";

const nativeFetch = globalThis.fetch;
let online = true,
  nukiCalls = 0,
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
      lock_id: string | null;
      nuki_auth_id: string | null;
      valid_from: Date;
      valid_until: Date;
      retry_at: Date | null;
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
        nukiCalls++;
        if (options?.method === "PUT") {
          putCount++;
          if (mode === "rejected")
            return new Response("rejected", { status: 429 });
          const body = JSON.parse(String(options.body));
          auths = [
            ...auths,
            {
              ...body,
              id: `auth-${putCount}`,
              smartlockId: 123,
              enabled: true,
              ...(mode === "pending" ? { operationId: "pending" } : {}),
            },
          ];
          if (mode === "lost") throw new Error("response lost");
          return new Response(null, { status: 204 });
        }
        if (options?.method === "DELETE") {
          if (deleteWorks)
            auths = auths.filter((a) => !String(url).endsWith(`/auth/${a.id}`));
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
      nukiCalls = 0;
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
    test("uncertain request with no visible authorization resubmits the same PIN once, only after the grace period", async (t) => {
      const id = await booking();
      mode = "pending";
      await fulfillReservation(id);
      const first = await code(id);
      const pin = decryptPin(
        first.encrypted_pin!,
        `access-code:${first.id}:${id}:123`,
        key,
      );
      assert.equal(String(auths[0]?.code), pin);
      auths = [];
      // Within the grace period an invisible authorization may still be syncing.
      t.mock.timers.setTime(now.getTime() + 9 * 60000);
      for (let i = 0; i < 6; i++) await fulfillReservation(id);
      assert.equal(putCount, 1);
      assert.equal((await code(id)).provision_state, "submitted");
      // An offline lock proves nothing, however long the wait.
      t.mock.timers.setTime(now.getTime() + 11 * 60000);
      online = false;
      await fulfillReservation(id);
      assert.equal(putCount, 1);
      assert.equal(
        (await rows("select * from message_delivery where kind='access_code'"))
          .length,
        0,
      );
      // The online lock confirms the PUT was lost: the same PIN goes again, once.
      online = true;
      for (let i = 0; i < 3; i++) await fulfillReservation(id);
      assert.equal(putCount, 2);
      const again = await code(id);
      assert.equal(again.id, first.id);
      assert.equal(again.code_hash, first.code_hash);
      assert.equal(auths.length, 1);
      assert.equal(String(auths[0]?.code), pin);
      assert.equal(
        Date.parse(String(auths[0]?.allowedFromDate)),
        first.valid_from.getTime(),
      );
      assert.equal(
        Date.parse(String(auths[0]?.allowedUntilDate)),
        first.valid_until.getTime(),
      );
      // A visible pending operation is never resubmitted, even past the grace.
      t.mock.timers.setTime(now.getTime() + 25 * 60000);
      await fulfillReservation(id);
      assert.equal(putCount, 2);
      delete auths[0]!.operationId;
      await fulfillReservation(id);
      assert.equal(putCount, 2);
      assert.equal((await code(id)).provision_state, "ready");
      const sent = await rows<{ status: string }>(
        "select status from message_delivery where kind='access_code'",
      );
      assert.deepEqual(
        sent.map((d) => d.status),
        ["sent"],
      );
      assert.ok(resend.sent.some((m) => JSON.stringify(m).includes(pin)));
    });
    test("conflicting PIN of a never-submitted intent is rotated on the same row", async () => {
      const id = await booking();
      online = false;
      await fulfillReservation(id);
      const prepared = await code(id);
      assert.equal(prepared.provision_state, "prepared");
      const identity = `access-code:${prepared.id}:${id}:123`;
      const taken = decryptPin(prepared.encrypted_pin!, identity, key);
      // Someone else's keypad code already uses the same digits.
      auths = [
        {
          id: "foreign",
          type: 13,
          smartlockId: 123,
          code: Number(taken),
          enabled: true,
          allowedFromDate: "2030-01-01T00:00:00.000Z",
          allowedUntilDate: "2031-01-01T00:00:00.000Z",
        },
      ];
      online = true;
      await fulfillReservation(id);
      const rotated = await code(id);
      assert.equal(rotated.id, prepared.id);
      assert.equal(rotated.provision_state, "ready");
      assert.notEqual(rotated.code_hash, prepared.code_hash);
      const pin = decryptPin(rotated.encrypted_pin!, identity, key);
      assert.notEqual(pin, taken);
      assert.equal(putCount, 1);
      assert.deepEqual(
        auths.map((a) => [a.id, String(a.code)]),
        [
          ["foreign", taken],
          ["auth-1", pin],
        ],
      );
      assert.equal(
        (await rows("select * from access_code where reservation_id=$1", [id]))
          .length,
        1,
      );
    });
    test("submitted intent with an ambiguous match is neither rotated nor resubmitted", async (t) => {
      const id = await booking();
      mode = "pending";
      await fulfillReservation(id);
      const first = await code(id);
      // A second match on the same PIN makes the state ambiguous, not lost.
      auths.push({ ...auths[0]!, id: "other" });
      t.mock.timers.setTime(now.getTime() + 11 * 60000);
      await fulfillReservation(id);
      const after = await code(id);
      assert.equal(putCount, 1);
      assert.equal(after.code_hash, first.code_hash);
      assert.equal(after.provision_state, "submitted");
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
    test("never-submitted intent is retired during a Wi-Fi outage without any lock call", async () => {
      const id = await booking();
      online = false;
      await fulfillReservation(id);
      assert.equal((await code(id)).provision_state, "prepared");
      nukiCalls = 0;
      await cancelReservation({ id });
      await reconcileRevocations();
      assert.equal(nukiCalls, 0);
      const c = await code(id);
      assert.equal(c.status, "revoked");
      assert.equal(c.encrypted_pin, null);
      const [r] = await rows<{ access_revocation_pending: boolean }>(
        "select access_revocation_pending from reservation where id=$1",
        [id],
      );
      assert.equal(r!.access_revocation_pending, false);
    });
    test("lost submission is retired on confirmed absence only after the grace period", async (t) => {
      const id = await booking();
      mode = "pending";
      await fulfillReservation(id);
      auths = [];
      await cancelReservation({ id });
      // Within the grace period the PUT may still land: keep holding the slot.
      assert.equal((await code(id)).status, "failed");
      const later = new Date(now.getTime() + 11 * 60000);
      t.mock.timers.setTime(later.getTime());
      // An offline lock is never proof of absence.
      online = false;
      await rows("update access_code set retry_at=$1", [later]);
      await reconcileRevocations();
      assert.equal((await code(id)).status, "failed");
      online = true;
      await rows("update access_code set retry_at=$1", [later]);
      await reconcileRevocations();
      const c = await code(id);
      assert.equal(c.status, "revoked");
      assert.equal(c.encrypted_pin, null);
      assert.equal(putCount, 1);
      const [r] = await rows<{ access_revocation_pending: boolean }>(
        "select access_revocation_pending from reservation where id=$1",
        [id],
      );
      assert.equal(r!.access_revocation_pending, false);
      assert.equal(
        (
          await rows(
            "select * from system_alert where dedupe_key=$1 and resolved_at is null",
            [`code-revocation:${id}`],
          )
        ).length,
        0,
      );
    });
    test("ended authorization leaves the lock and expires; running windows stay", async (t) => {
      const ended = await booking(30);
      const running = await booking(300);
      await fulfillReservation(ended);
      await fulfillReservation(running);
      assert.equal(auths.length, 2);
      const c = await code(ended);
      // Inside the 30-minute grace after the window, nothing is touched.
      t.mock.timers.setTime(c.valid_until.getTime() + 29 * 60000);
      assert.equal(await expireEndedCodes(), 0);
      assert.equal(auths.length, 2);
      assert.equal((await code(ended)).status, "scheduled");
      // An offline lock removes nothing; the sweep simply comes back later.
      t.mock.timers.setTime(c.valid_until.getTime() + 31 * 60000);
      online = false;
      assert.equal(await expireEndedCodes(), 0);
      assert.equal(auths.length, 2);
      assert.equal((await code(ended)).status, "scheduled");
      assert.ok((await code(ended)).retry_at);
      online = true;
      await rows("update access_code set retry_at=null");
      assert.equal(await expireEndedCodes(), 1);
      const gone = await code(ended);
      assert.equal(gone.status, "expired");
      assert.equal(gone.encrypted_pin, null);
      assert.deepEqual(
        auths.map((a) => a.id),
        [(await code(running)).nuki_auth_id],
      );
      const kept = await code(running);
      assert.equal(kept.status, "scheduled");
      assert.ok(kept.encrypted_pin);
      assert.equal(putCount, 2);
    });
    test("repeated expiry failures raise one alert and keep retrying", async (t) => {
      const id = await booking();
      await fulfillReservation(id);
      const c = await code(id);
      t.mock.timers.setTime(c.valid_until.getTime() + 31 * 60000);
      deleteWorks = false;
      for (let i = 0; i < 8; i++) {
        await rows("update access_code set retry_at=null");
        await expireEndedCodes();
      }
      assert.equal((await code(id)).status, "scheduled");
      const alerts = () =>
        rows<{ resolved_at: Date | null }>(
          "select resolved_at from system_alert where dedupe_key=$1",
          [`code-expiry:${c.id}`],
        );
      assert.equal((await alerts()).length, 1);
      deleteWorks = true;
      await rows("update access_code set retry_at=null");
      await expireEndedCodes();
      assert.equal((await code(id)).status, "expired");
      assert.equal(auths.length, 0);
      assert.ok((await alerts())[0]!.resolved_at);
    });
    test("offline cancellation holds slot through database constraint until confirmed deletion", async () => {
      const id = await booking();
      await fulfillReservation(id);
      // A pre-migration code has no device binding or encrypted PIN yet.
      await rows(
        "update access_code set lock_id=null, encrypted_pin=null where reservation_id=$1",
        [id],
      );
      online = false;
      await cancelReservation({ id });
      assert.equal((await code(id)).lock_id, "123");
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
