import {
  databaseReady,
  seedProfile,
  resetDatabase,
  rows,
  setSetting,
  startProviders,
  stopEverything,
  resend,
} from "./setup";
import assert from "node:assert/strict";
import postgres from "postgres";
import { NextRequest } from "next/server";
import { after, before, beforeEach, describe, test } from "node:test";
import { env } from "../../src/lib/env";
import { fulfillReservation } from "../../src/lib/services/fulfillment";
import {
  closeFinishedPipelines,
  initPipeline,
  dueForRetry,
} from "../../src/lib/services/pipeline";
import { cancelReservation } from "../../src/lib/services/reservations";
import {
  expireEndedCodes,
  reconcileRevocations,
} from "../../src/lib/services/access-codes";
import { checkAvailability } from "../../src/lib/services/availability";
import { decryptPin } from "../../src/lib/helpers/pin-vault";
import { GET as watchdog } from "../../src/app/api/cron/watchdog/route";

import { rescheduleReservation } from "../../src/lib/services/rescheduling";
import { getSlotsForRange } from "../../src/lib/services/slots";
import { findOverlappingReservations } from "../../src/lib/services/schedule";

const nativeFetch = globalThis.fetch;
let online = true,
  nukiCalls = 0,
  putCount = 0,
  mode: "ok" | "lost" | "rejected" | "pending" = "ok",
  deleteWorks = true;
let auths: Array<Record<string, unknown>> = [];
let emails: Array<{ at: number; body: string }> = [];
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
async function steps(id: string) {
  return (
    await rows<{ step: string; status: string; next_retry_at: Date | null }>(
      "select step, status, next_retry_at from reservation_pipeline where reservation_id=$1 order by step::text",
      [id],
    )
  ).map((r) => [r.step, r.status, r.next_retry_at]);
}
async function openStepAlerts(id: string) {
  return rows(
    "select * from system_alert where dedupe_key like $1 and resolved_at is null",
    [`reservation:${id}:%`],
  );
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
        if (!String(url).startsWith("https://api.nuki.io/")) {
          if (String(url).startsWith(process.env.RESEND_BASE_URL!))
            emails.push({ at: performance.now(), body: String(options?.body) });
          return nativeFetch(url, options);
        }
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
    async function movableBooking() {
      const user = {
        id: "22222222-2222-4222-8222-222222222222",
        email: "move@example.test",
        fullName: "Synthetic Move",
      };
      await seedProfile(user);
      const original = new Date("2030-10-05T10:00:00Z");
      const target = new Date("2030-10-01T13:00:00Z");
      const [row] = await rows<{ id: string }>(
        `insert into reservation (user_id, starts_at, ends_at, status, price_cents, contact_email) values ($1,$2,$3,'confirmed',19900,$4) returning id`,
        [
          user.id,
          original,
          new Date(original.getTime() + 60 * 60000),
          user.email,
        ],
      );
      await initPipeline(row!.id);
      return { id: row!.id, userId: user.id, original, target };
    }
    async function storedMove(id: string) {
      return (
        await rows<{
          status: string;
          starts_at: Date;
          reschedule_starts_at: Date | null;
        }>(
          "select status,starts_at,reschedule_starts_at from reservation where id=$1",
          [id],
        )
      )[0]!;
    }

    test("offline move refuses success, preserves the original and does not consume the change (#170)", async () => {
      const b = await movableBooking();
      online = false;
      await assert.rejects(
        rescheduleReservation({
          reservationId: b.id,
          userId: b.userId,
          startsAt: b.target,
        }),
      );
      const row = await storedMove(b.id);
      assert.equal(row.status, "confirmed");
      assert.equal(row.starts_at.getTime(), b.original.getTime());
      assert.equal(row.reschedule_starts_at, null);
      assert.equal(
        (await rows("select id from reservation_reschedule")).length,
        0,
      );
      assert.equal(
        (
          await rows(
            "select id from message_delivery where dedupe_key like 'reschedule-confirmation/%'",
          )
        ).length,
        0,
      );
      assert.equal(
        (
          await checkAvailability(
            b.target,
            new Date(b.target.getTime() + 60 * 60000),
          )
        ).available,
        true,
      );
      online = true;
      const moved = await rescheduleReservation({
        reservationId: b.id,
        userId: b.userId,
        startsAt: b.target,
      });
      assert.equal(moved.startsAt.getTime(), b.target.getTime());
      const active = await rows<{ provision_state: string }>(
        "select provision_state from access_code where reservation_id=$1 and status not in ('revoked','expired')",
        [b.id],
      );
      assert.deepEqual(
        active.map((row) => row.provision_state),
        ["ready"],
      );
    });

    test("uncertain target access holds both windows at the database until restart cleanup (#170)", async () => {
      const b = await movableBooking();
      mode = "pending";
      await assert.rejects(
        rescheduleReservation({
          reservationId: b.id,
          userId: b.userId,
          startsAt: b.target,
        }),
      );
      const row = await storedMove(b.id);
      assert.equal(row.starts_at.getTime(), b.original.getTime());
      assert.equal(row.reschedule_starts_at?.getTime(), b.target.getTime());
      assert.equal(
        (await dueForRetry()).some((step) => step.reservationId === b.id),
        true,
      );
      for (const start of [b.original, b.target]) {
        await assert.rejects(
          rows(
            `insert into reservation (starts_at,ends_at,status,price_cents) values ($1,$2,'confirmed',19900)`,
            [start, new Date(start.getTime() + 60 * 60000)],
          ),
          (error: unknown) =>
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "23P01",
        );
        assert.equal(
          (
            await checkAvailability(
              start,
              new Date(start.getTime() + 60 * 60000),
            )
          ).available,
          false,
        );
      }
      assert.equal(
        (
          await findOverlappingReservations(
            b.target,
            new Date(b.target.getTime() + 60 * 60000),
          )
        )[0]?.id,
        b.id,
      );
      const calendar = await getSlotsForRange("2030-10-01", "2030-10-02", now);
      assert.equal(
        calendar.days[0]!.slots.find(
          (slot) => slot.start.getTime() === b.target.getTime(),
        )?.available,
        false,
      );
      // The device eventually reports a definite authorization; cleanup can
      // now revoke it and release the rejected target, without moving the user.
      auths = auths.map((auth) => {
        const settled = { ...auth };
        delete settled.operationId;
        return settled;
      });
      mode = "ok";
      await fulfillReservation(b.id);
      assert.equal((await storedMove(b.id)).reschedule_starts_at, null);
      assert.equal(
        (await storedMove(b.id)).starts_at.getTime(),
        b.original.getTime(),
      );
      assert.equal(
        (
          await checkAvailability(
            b.target,
            new Date(b.target.getTime() + 60 * 60000),
          )
        ).available,
        true,
      );
      assert.equal(auths.length, 0);
      assert.equal((await code(b.id)).encrypted_pin, null);
    });

    test("successful near-term move verifies its exact window before recording confirmation (#170)", async () => {
      const b = await movableBooking();
      const moved = await rescheduleReservation({
        reservationId: b.id,
        userId: b.userId,
        startsAt: b.target,
      });
      const ready = await code(b.id);
      assert.equal(ready.provision_state, "ready");
      assert.equal(ready.valid_from.getTime(), b.target.getTime());
      assert.equal(
        ready.valid_until.getTime(),
        moved.endsAt.getTime() + 15 * 60000,
      );
      assert.equal(moved.rescheduleStartsAt, null);
      assert.equal(
        (
          await checkAvailability(
            b.original,
            new Date(b.original.getTime() + 60 * 60000),
          )
        ).available,
        true,
      );
      assert.equal(
        (await rows("select id from reservation_reschedule")).length,
        1,
      );
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
    for (const hours of [1, 6, 24]) {
      test(`recovery after ${hours}h outage prepares upcoming access and never delivers an ended visit (#171)`, async (t) => {
        const upcoming = await booking(hours * 60 + 30);
        const ended = await booking(-120);
        online = false;
        await fulfillReservation(upcoming);
        const saved = await rows<{ id: string }>(
          "select id from access_code where reservation_id=$1",
          [upcoming],
        );
        t.mock.timers.setTime(now.getTime() + hours * 60 * 60_000);
        online = true;
        await fulfillReservation(upcoming);
        await fulfillReservation(ended);
        await closeFinishedPipelines();
        assert.equal((await code(upcoming)).provision_state, "ready");
        if (saved.length) assert.equal((await code(upcoming)).id, saved[0]!.id);
        assert.equal(
          (
            await rows(
              "select id from message_delivery where reservation_id=$1 and kind='access_code' and status='sent'",
              [upcoming],
            )
          ).length,
          1,
        );
        assert.equal(
          (
            await rows("select id from access_code where reservation_id=$1", [
              ended,
            ])
          ).length,
          0,
        );
        assert.equal(
          (
            await rows(
              "select id from message_delivery where reservation_id=$1 and kind='access_code'",
              [ended],
            )
          ).length,
          0,
        );
      });
    }

    test("crashed far-future move is cleaned even with code preparation disabled (#170)", async () => {
      const b = await movableBooking();
      const target = new Date("2030-10-07T13:00:00Z");
      await rows(
        "update reservation set reschedule_starts_at=$1,reschedule_ends_at=$2 where id=$3",
        [target, new Date(target.getTime() + 60 * 60_000), b.id],
      );
      await setSetting("booking.operations", {
        paymentsEnabled: true,
        bookingsFrom: "",
        accessCodesEnabled: false,
      });
      assert.ok(
        (await dueForRetry()).some((step) => step.reservationId === b.id),
      );
      await fulfillReservation(b.id);
      assert.equal((await storedMove(b.id)).reschedule_starts_at, null);
      assert.equal(
        (await storedMove(b.id)).starts_at.getTime(),
        b.original.getTime(),
      );
      assert.equal(
        (await rows("select id from reservation_reschedule")).length,
        0,
      );
      assert.equal(nukiCalls, 0);
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
    test("cancellation closes the pipeline and resolves its step alerts", async () => {
      const id = await booking();
      online = false;
      for (let n = 0; n < 5; n++) await fulfillReservation(id);
      assert.equal((await openStepAlerts(id)).length, 1);
      await cancelReservation({ id });
      assert.deepEqual(await steps(id), [
        ["code_created", "failed", null],
        ["code_delivered", "failed", null],
        ["payment", "succeeded", null],
      ]);
      assert.equal((await openStepAlerts(id)).length, 0);
    });
    test("watchdog sweep closes pipelines of ended reservations only", async (t) => {
      const ended = await booking();
      online = false;
      for (let n = 0; n < 5; n++) await fulfillReservation(ended);
      assert.equal((await openStepAlerts(ended)).length, 1);
      const upcoming = await booking(300);
      // Ongoing reservations are left alone.
      assert.equal(await closeFinishedPipelines(), 0);
      t.mock.timers.setTime(now.getTime() + 91 * 60000);
      assert.equal(await closeFinishedPipelines(), 1);
      assert.deepEqual(await steps(ended), [
        ["code_created", "failed", null],
        ["code_delivered", "failed", null],
        ["payment", "succeeded", null],
      ]);
      assert.equal((await openStepAlerts(ended)).length, 0);
      assert.ok(
        (await steps(upcoming)).every(([, status]) => status === "pending"),
      );
      assert.equal(await closeFinishedPipelines(), 0);
    });
    test("watchdog delivers due PINs while revocation is stuck on a busy reservation", async () => {
      const cancelled = await booking(120);
      await fulfillReservation(cancelled);
      online = false;
      await cancelReservation({ id: cancelled });
      online = true;
      await rows("update access_code set retry_at=null");
      const due = await booking(30);
      // Another process holds the cancelled reservation's lock past the timeout.
      const blocker = postgres(process.env.DATABASE_URL!, { max: 1 });
      await blocker`select pg_advisory_lock(hashtextextended(${`reservation:${cancelled}`}, 0))`;
      let response: Response;
      emails = [];
      const started = performance.now();
      try {
        env.CRON_SECRET = "test-cron";
        response = await watchdog(
          new NextRequest("https://navigym.test/api/cron/watchdog", {
            headers: { authorization: "Bearer test-cron" },
          }),
        );
      } finally {
        await blocker.end();
      }
      const finished = performance.now();
      assert.equal(response.status, 200);
      assert.equal((await response.json()).processed, 1);
      const ready = await code(due);
      assert.equal(ready.provision_state, "ready");
      const pin = decryptPin(
        ready.encrypted_pin!,
        `access-code:${ready.id}:${due}:123`,
        key,
      );
      // The PIN goes out before revocation waits out the busy lock (5 s).
      const pinEmail = emails.find((e) => e.body.includes(pin));
      assert.ok(pinEmail);
      assert.ok(pinEmail.at - started < 4000);
      assert.ok(finished - started > 5000);
      assert.equal(
        (
          await rows(
            "select * from message_delivery where kind='access_code' and status='sent' and reservation_id=$1",
            [due],
          )
        ).length,
        1,
      );
      assert.equal((await code(cancelled)).status, "scheduled");
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
