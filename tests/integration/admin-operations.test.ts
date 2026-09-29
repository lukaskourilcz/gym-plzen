/**
 * Administration paths against a real (local) Postgres: what the database
 * itself refuses (exclusion and unique constraints through drizzle's error
 * wrapper), closures over existing bookings, blocks that started before the
 * listed range, and the rules for manual bookings and cancellations.
 *
 *   npm run test:integration        # needs DATABASE_URL to a local Postgres
 */
import {
  databaseReady,
  resend,
  resetDatabase,
  rows,
  seedProfile,
  startProviders,
  stopEverything,
} from "./setup";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { db } from "../../src/lib/db";
import { blockedSlot } from "../../src/lib/db/schema";
import { lockSchedule } from "../../src/lib/services/availability";
import { setTimeout } from "node:timers/promises";
import { reservation as reservationTable } from "../../src/lib/db/schema";
import type { NewReservation } from "../../src/lib/db/types";
import { ActionError } from "../../src/lib/helpers/action";
import {
  addDaysToDateKey,
  addMinutes,
  dateKeyInTimeZone,
  localDateTimeToDate,
} from "../../src/lib/helpers/datetime";
import {
  cancelReservation,
  createReservation,
} from "../../src/lib/services/reservations";
import { createVoucher } from "../../src/lib/services/vouchers";
import { listBlockedSlots } from "../../src/lib/services/schedule";
import { listCalendarEntries } from "../../src/lib/services/availability";
import { closeTimeRange } from "../../src/lib/services/closures";
import {
  cancelByAdmin,
  createManualReservation,
  OFF_GRID_MESSAGE,
  PAST_CANCEL_MESSAGE,
  PAST_START_MESSAGE,
} from "../../src/lib/services/admin-reservations";

const ADMIN = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "spravce@example.test",
};

/** A slot `daysAhead` from today at a Prague wall-clock minute. */
function at(daysAhead: number, minute = 10 * 60): Date {
  return localDateTimeToDate(
    addDaysToDateKey(dateKeyInTimeZone(new Date()), daysAhead),
    minute,
  );
}

async function insertReservation(
  startsAt: Date,
  endsAt: Date,
  status = "confirmed",
  email = "zakaznik@example.test",
): Promise<string> {
  const [row] = await rows<{ id: string }>(
    "insert into reservation (starts_at, ends_at, status, contact_email, contact_name) values ($1, $2, $3, $4, 'Zákazník Testový') returning id",
    [startsAt.toISOString(), endsAt.toISOString(), status, email],
  );
  return row!.id;
}

async function statusOf(id: string): Promise<string | undefined> {
  const [row] = await rows<{ status: string }>(
    "select status from reservation where id = $1",
    [id],
  );
  return row?.status;
}

async function rejection(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    assert.ok(error instanceof ActionError, String(error));
    return error.message;
  }
  assert.fail("expected the call to be refused");
}

describe(
  "administration against the database",
  { skip: !databaseReady },
  () => {
    before(startProviders);
    after(stopEverything);
    beforeEach(async () => {
      await resetDatabase();
      await seedProfile({ ...ADMIN, fullName: "Správce Testový" });
    });

    test("a booking appearing while a block is created requires fresh cancellation confirmation", async () => {
      await rows(
        "create function test_race_block() returns trigger language plpgsql as $$ begin insert into reservation(starts_at,ends_at,status,contact_email) values(NEW.starts_at, NEW.starts_at + interval '75 minutes', 'confirmed', 'race@example.test'); return NEW; end $$",
      );
      await rows(
        "create trigger test_race_block before insert on blocked_slot for each row execute function test_race_block()",
      );
      try {
        const result = await closeTimeRange({
          startsAt: at(3),
          endsAt: addMinutes(at(3), 75),
          reason: "maintenance",
          admin: ADMIN,
        });
        assert.equal(result.status, "needs_confirmation");
        if (result.status === "needs_confirmation")
          assert.equal(result.affectedCount, 1);
        assert.equal(
          (await rows<{ status: string }>("select status from reservation"))[0]!
            .status,
          "confirmed",
        );
        assert.equal((await rows("select id from blocked_slot")).length, 1);
        assert.equal(resend.sent.length, 0);
      } finally {
        await rows("drop trigger test_race_block on blocked_slot");
        await rows("drop function test_race_block()");
      }
    });

    test("booking waits for an uncommitted block and rechecks availability after its commit", async () => {
      const startsAt = at(3);
      const endsAt = addMinutes(startsAt, 60);
      let attempt!: Promise<string>;
      await db.transaction(async (tx) => {
        await lockSchedule(tx, "exclusive");
        await tx.insert(blockedSlot).values({ startsAt, endsAt });
        attempt = rejection(
          createReservation({
            startsAt,
            endsAt,
            contactEmail: "waiting@example.test",
          }),
        );
        // Let the other connection start while the block is still uncommitted.
        await setTimeout(30);
      });
      assert.equal(await attempt, "Tento termín je blokovaný.");
      assert.equal((await rows("select id from reservation")).length, 0);
    });

    describe("constraint violations surface as Czech messages", () => {
      test("a booking that loses the race at the exclusion constraint", async () => {
        const startsAt = at(3);
        const endsAt = addMinutes(startsAt, 60);
        // The availability check passes (the slot is free), then a competing
        // checkout lands its row before our insert: exactly the race the
        // reservation_no_overlap constraint exists for. drizzle 0.45 wraps the
        // resulting 23P01 in a DrizzleQueryError, with the code on `cause`.
        const racing = new Proxy(db, {
          get(target, property, receiver) {
            if (property !== "insert")
              return Reflect.get(target, property, receiver);
            return (table: typeof reservationTable) => ({
              values: (values: NewReservation) => ({
                returning: async () => {
                  await insertReservation(
                    startsAt,
                    endsAt,
                    "confirmed",
                    "jiny@example.test",
                  );
                  return target.insert(table).values(values).returning();
                },
              }),
            });
          },
        });

        const message = await rejection(
          createReservation(
            { startsAt, endsAt, contactEmail: "pomaly@example.test" },
            racing as typeof db,
          ),
        );
        assert.equal(
          message,
          "Tento termín právě rezervoval jiný zákazník. Vyberte prosím jiný čas.",
        );
        const active = await rows(
          "select id from reservation where status in ('pending','confirmed')",
        );
        assert.equal(active.length, 1, "only the winner of the race remains");
      });

      test("a voucher code that already exists, in any letter case", async () => {
        await createVoucher({
          code: "NAVIOPEN",
          kind: "percentage",
          value: 10,
          createdByAdminId: ADMIN.id,
        });
        const message = await rejection(
          createVoucher({
            code: "naviopen",
            kind: "fixed_amount",
            value: 5000,
            createdByAdminId: ADMIN.id,
          }),
        );
        assert.equal(message, "Voucher s tímto kódem už existuje.");
        assert.equal((await rows("select id from voucher")).length, 1);
      });
    });

    describe("blocks that started before the listed range", () => {
      test("an ongoing closure stays visible on the schedule and the calendar", async () => {
        const now = new Date();
        const ongoing = { startsAt: at(-3, 0), endsAt: at(3, 0) };
        const future = { startsAt: at(5), endsAt: at(5, 12 * 60) };
        const past = { startsAt: at(-10), endsAt: at(-9) };
        for (const block of [ongoing, future, past])
          await rows(
            "insert into blocked_slot (starts_at, ends_at, reason) values ($1, $2, 'holiday')",
            [block.startsAt.toISOString(), block.endsAt.toISOString()],
          );

        const listed = await listBlockedSlots(
          now,
          addMinutes(now, 60 * 24 * 90),
        );
        assert.deepEqual(
          listed.map((b) => b.startsAt.toISOString()),
          [ongoing.startsAt.toISOString(), future.startsAt.toISOString()],
        );

        const calendar = await listCalendarEntries(
          now,
          addMinutes(now, 60 * 24),
        );
        assert.deepEqual(
          calendar.blocks.map((b) => b.startsAt.toISOString()),
          [ongoing.startsAt.toISOString()],
        );
      });
    });

    describe("closing a range over existing bookings", () => {
      test("asks first, cancels only once confirmed, and never duplicates the block", async () => {
        const startsAt = at(4, 9 * 60);
        const endsAt = at(4, 12 * 60);
        const inside = await insertReservation(at(4, 10 * 60), at(4, 11 * 60));
        const outside = await insertReservation(at(4, 14 * 60), at(4, 15 * 60));
        const request = {
          startsAt,
          endsAt,
          reason: "maintenance" as const,
          note: "Oprava sprchy",
          admin: ADMIN,
        };

        const first = await closeTimeRange(request);
        assert.equal(first.status, "needs_confirmation");
        assert.equal(
          first.status === "needs_confirmation" && first.message,
          "Uzavření zruší 1 rezervaci a zákazníkům odejde e-mail. Potvrďte znovu.",
        );
        assert.equal(await statusOf(inside), "confirmed");
        assert.equal((await rows("select id from blocked_slot")).length, 0);
        assert.equal(
          resend.sent.length,
          0,
          "nobody is e-mailed before the confirmation",
        );

        // Confirming a different number than the server counted is not consent.
        const wrongCount = await closeTimeRange({
          ...request,
          confirmCancellations: 2,
        });
        assert.equal(wrongCount.status, "needs_confirmation");
        assert.equal(await statusOf(inside), "confirmed");

        const confirmed = await closeTimeRange({
          ...request,
          confirmCancellations: 1,
        });
        assert.equal(confirmed.status, "closed");
        assert.ok(confirmed.status === "closed" && confirmed.blockCreated);
        assert.equal(await statusOf(inside), "cancelled");
        assert.equal(await statusOf(outside), "confirmed");
        assert.ok(
          resend.sent.some((mail) =>
            JSON.stringify(mail).includes("Oprava sprchy"),
          ),
          "the note reaches the customer as the reason",
        );

        const repeated = await closeTimeRange(request);
        assert.equal(repeated.status, "closed");
        assert.ok(repeated.status === "closed" && !repeated.blockCreated);
        assert.equal((await rows("select id from blocked_slot")).length, 1);
      });

      test("a cancellation that fails is reported, and the retry finishes it without a second block", async () => {
        const startsAt = at(6, 8 * 60);
        const endsAt = at(6, 12 * 60);
        const first = await insertReservation(at(6, 8 * 60), at(6, 9 * 60));
        const second = await insertReservation(at(6, 10 * 60), at(6, 11 * 60));
        const request = {
          startsAt,
          endsAt,
          reason: "other" as const,
          admin: ADMIN,
          confirmCancellations: 2,
        };

        const partial = await closeTimeRange(request, {
          cancel: async (params) => {
            if (params.id === first) throw new Error("lock provider timed out");
            return cancelReservation(params);
          },
        });
        assert.equal(partial.status, "closed");
        assert.ok(partial.status === "closed");
        assert.equal(partial.cancelledCount, 1);
        assert.deepEqual(
          partial.failed.map((f) => f.id),
          [first],
        );
        assert.equal(await statusOf(first), "confirmed");
        assert.equal(await statusOf(second), "cancelled");

        const retryAsk = await closeTimeRange({
          ...request,
          confirmCancellations: undefined,
        });
        assert.equal(retryAsk.status, "needs_confirmation");
        assert.ok(
          retryAsk.status === "needs_confirmation" &&
            retryAsk.affectedCount === 1,
        );

        const retry = await closeTimeRange({
          ...request,
          confirmCancellations: 1,
        });
        assert.ok(retry.status === "closed" && !retry.blockCreated);
        assert.equal(retry.status === "closed" && retry.failed.length, 0);
        assert.equal(await statusOf(first), "cancelled");
        assert.equal((await rows("select id from blocked_slot")).length, 1);
      });
    });

    describe("manual bookings", () => {
      test("the end comes from the configured window, not from the form", async () => {
        // The test database runs 60-minute windows from midnight.
        const startsAt = at(2, 10 * 60);
        const created = await createManualReservation({
          startsAt,
          contactName: "Host U Dveří",
          admin: ADMIN,
        });
        assert.equal(created.startsAt.toISOString(), startsAt.toISOString());
        assert.equal(
          created.endsAt.toISOString(),
          addMinutes(startsAt, 60).toISOString(),
        );
        assert.equal(created.status, "confirmed");
        assert.equal(created.createdByAdminId, ADMIN.id);
      });

      test("an off-grid start that would straddle two public slots is refused", async () => {
        const message = await rejection(
          createManualReservation({
            startsAt: at(2, 10 * 60 + 30),
            admin: ADMIN,
          }),
        );
        assert.equal(message, OFF_GRID_MESSAGE);
        assert.equal((await rows("select id from reservation")).length, 0);
      });

      test("a start in the past is refused", async () => {
        const message = await rejection(
          createManualReservation({ startsAt: at(-1, 10 * 60), admin: ADMIN }),
        );
        assert.equal(message, PAST_START_MESSAGE);
        assert.equal((await rows("select id from reservation")).length, 0);
      });
    });

    describe("cancelling from the administration", () => {
      test("the reason is stored and sent to the customer", async () => {
        const id = await insertReservation(at(3), at(3, 11 * 60));
        await cancelByAdmin({ id, reason: "Porucha zámku", admin: ADMIN });
        const [row] = await rows<{ status: string; cancel_reason: string }>(
          "select status, cancel_reason from reservation where id = $1",
          [id],
        );
        assert.equal(row?.status, "cancelled");
        assert.equal(row?.cancel_reason, "Porucha zámku");
        assert.ok(
          resend.sent.some((mail) =>
            JSON.stringify(mail).includes("Porucha zámku"),
          ),
        );
      });

      test("a reservation that has already ended cannot be cancelled", async () => {
        const id = await insertReservation(at(-1), at(-1, 11 * 60));
        const message = await rejection(
          cancelByAdmin({ id, reason: "Omyl", admin: ADMIN }),
        );
        assert.equal(message, PAST_CANCEL_MESSAGE);
        assert.equal(await statusOf(id), "confirmed");
        assert.equal(resend.sent.length, 0);
      });
    });
  },
);
