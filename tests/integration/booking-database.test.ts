import assert from "node:assert/strict";
import { after, before, test, mock } from "node:test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import * as schema from "../../src/lib/db/schema/index";

// Real Postgres SQL in memory. No production URL, provider request or message
// can escape this suite. This is not a multi-connection Supabase load test.
const pg = new PGlite();
const database = drizzle(pg, { schema });
mock.module("../../src/lib/db/index.ts", {
  namedExports: { db: database, schema },
});
const { withReservationOperation } =
  await import("../../src/lib/services/reservation-operations");
const { recordPayment, markCheckoutPaymentFailed } =
  await import("../../src/lib/services/memberships");
const { recordWebhookEvent, markWebhookProcessed } =
  await import("../../src/lib/services/webhooks");
const { createReservation, confirmReservation, cancelReservation } =
  await import("../../src/lib/services/reservations");
const { createBlockedSlot, listBlockedSlots, setOpeningHours } =
  await import("../../src/lib/services/schedule");
const { checkAvailability } =
  await import("../../src/lib/services/availability");
const { fulfillReservation } =
  await import("../../src/lib/services/fulfillment");
const { countAdmins, setRole } = await import("../../src/lib/services/members");
const { dueForRetry } = await import("../../src/lib/services/pipeline");

before(async () => {
  mock.method(globalThis, "fetch", () => {
    throw new Error("External I/O forbidden in database tests");
  });
  await pg.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  for (const file of [
    "0000_init.sql",
    "0006_payment_checkout_session_full_uniq.sql",
    "0007_reservation_consents.sql",
    "0008_reservation_rescheduling.sql",
    "0009_vouchers_and_newsletter.sql",
    "0010_billing_documents.sql",
  ]) {
    await pg.exec(await readFile(`drizzle/${file}`, "utf8"));
  }
  // tstzrange's native GiST operator needs no btree_gist extension.
  await pg.exec(
    "ALTER TABLE reservation ADD CONSTRAINT reservation_no_overlap EXCLUDE USING gist (tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('pending', 'confirmed'));",
  );
  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
    await setOpeningHours({ dayOfWeek, openMinute: 300, closeMinute: 1425 });
  }
});
after(async () => {
  mock.restoreAll();
  await pg.close();
});

function slot(day: number) {
  return {
    startsAt: new Date(`2090-01-${String(day).padStart(2, "0")}T09:00:00Z`),
    endsAt: new Date(`2090-01-${String(day).padStart(2, "0")}T10:15:00Z`),
  };
}

test("late pending mirror and expiry cannot downgrade a successful payment", async () => {
  const input = {
    stripeCheckoutSessionId: "cs_test_regression",
    type: "one_off" as const,
    amountCents: 28900,
  };
  await recordPayment({
    ...input,
    status: "succeeded",
    stripePaymentIntentId: "pi_regression",
  });
  const late = await recordPayment({ ...input, status: "pending" });
  assert.equal(late.status, "succeeded");
  await markCheckoutPaymentFailed(input.stripeCheckoutSessionId, "late_expiry");
  const [stored] = await database
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.id, late.id));
  assert.equal(stored!.status, "succeeded");
  assert.equal(stored!.stripePaymentIntentId, "pi_regression");
});

test("webhook claims distinguish in-flight, completed and abandoned events", async () => {
  const input = { provider: "stripe", eventId: "evt_regression" };
  assert.equal((await recordWebhookEvent(input)).isNew, true);
  assert.deepEqual(await recordWebhookEvent(input), {
    isNew: false,
    processing: true,
  });
  await database
    .update(schema.webhookEvent)
    .set({ createdAt: new Date(Date.now() - 11 * 60_000) })
    .where(eq(schema.webhookEvent.eventId, input.eventId));
  assert.equal((await recordWebhookEvent(input)).isNew, true);
  await markWebhookProcessed(input.provider, input.eventId);
  assert.deepEqual(await recordWebhookEvent(input), {
    isNew: false,
    processing: false,
  });
});

test("reservation lease rejects overlap, releases on failure and recovers a crashed owner", async () => {
  const id = randomUUID();
  await withReservationOperation(id, async () => {
    await assert.rejects(
      withReservationOperation(id, async () => {}),
      /právě zpracovává/,
    );
  });
  await assert.rejects(
    withReservationOperation(id, async () => {
      throw new Error("simulated crash");
    }),
    /simulated/,
  );
  await withReservationOperation(id, async () => {});
  await database.insert(schema.webhookEvent).values({
    provider: "internal:reservation-operation",
    eventId: id,
    createdAt: new Date(Date.now() - 11 * 60_000),
  });
  await withReservationOperation(id, async () => {});
  const left = await database
    .select()
    .from(schema.webhookEvent)
    .where(eq(schema.webhookEvent.eventId, id));
  assert.equal(left.length, 0);
});

test("confirmed booking creates its pipeline atomically and blocks both bookings and admin closures", async () => {
  const first = await createReservation({ ...slot(1), status: "confirmed" });
  const steps = await database
    .select()
    .from(schema.reservationPipeline)
    .where(eq(schema.reservationPipeline.reservationId, first.id));
  assert.equal(steps.length, 3);
  await assert.rejects(createReservation(slot(1)), /rezervovan/);
  await assert.rejects(createBlockedSlot(slot(1)), /obsahuje rezervaci/);
  assert.equal(
    (await checkAvailability(slot(1).startsAt, slot(1).endsAt)).available,
    false,
  );
  // The database still protects callers bypassing the service.
  await assert.rejects(database.insert(schema.reservation).values(slot(1)));
});

test("blocks starting outside a viewed month remain visible and prevent booking", async () => {
  await createBlockedSlot({
    startsAt: new Date("2090-02-28T20:00:00Z"),
    endsAt: new Date("2090-03-01T12:00:00Z"),
  });
  const blocks = await listBlockedSlots(
    new Date("2090-03-01T00:00:00Z"),
    new Date("2090-04-01T00:00:00Z"),
  );
  assert.equal(blocks.length, 1);
  await assert.rejects(
    createReservation({
      startsAt: new Date("2090-03-01T09:00:00Z"),
      endsAt: new Date("2090-03-01T10:15:00Z"),
    }),
    /blokovaný/,
  );
});

test("cancellation clears retry work and cannot be revived by payment or fulfillment", async () => {
  const row = await createReservation({ ...slot(3), status: "confirmed" });
  await cancelReservation({ id: row.id });
  assert.equal(await confirmReservation(row.id), false);
  await fulfillReservation(row.id);
  assert.equal(
    (
      await database
        .select()
        .from(schema.accessCode)
        .where(eq(schema.accessCode.reservationId, row.id))
    ).length,
    0,
  );
  assert.equal(
    (await dueForRetry()).some((step) => step.reservationId === row.id),
    false,
  );
});

test("opening-hour default is 75 minutes and cross-midnight ranges are rejected", async () => {
  const hours = await setOpeningHours({
    dayOfWeek: 1,
    openMinute: 300,
    closeMinute: 1425,
  });
  assert.equal(hours.slotMinutes, 75);
  const result = await checkAvailability(
    new Date("2090-01-08T09:00:00Z"),
    new Date("2090-01-09T10:00:00Z"),
  );
  assert.equal(result.available, false);
});

test("last administrator cannot be removed while a second can be demoted", async () => {
  const first = randomUUID(),
    second = randomUUID();
  await database.insert(schema.profiles).values([
    { id: first, email: "first@example.test", role: "admin" },
    { id: second, email: "second@example.test", role: "admin" },
    { id: randomUUID(), email: "admin@namaste.demo", role: "admin" },
  ]);
  await setRole(second, "member");
  await assert.rejects(setRole(first, "member"), /posledního správce/);
  assert.equal(await countAdmins(), 1);
});

test("an expiry racing a successful confirmation cannot cancel the paid reservation", async () => {
  const row = await createReservation(slot(4));
  assert.equal(await confirmReservation(row.id), true);
  await cancelReservation({
    id: row.id,
    onlyIfPending: true,
    reason: "late_expiry",
  });
  const [stored] = await database
    .select()
    .from(schema.reservation)
    .where(eq(schema.reservation.id, row.id));
  assert.equal(stored!.status, "confirmed");
});

test("a pending later step cannot bypass backoff or exhausted retries", async () => {
  const row = await createReservation({ ...slot(5), status: "confirmed" });
  await database
    .update(schema.reservationPipeline)
    .set({ status: "retrying", nextRetryAt: new Date(Date.now() + 60_000) })
    .where(
      and(
        eq(schema.reservationPipeline.reservationId, row.id),
        eq(schema.reservationPipeline.step, "code_created"),
      ),
    );
  assert.equal(
    (await dueForRetry()).some((step) => step.reservationId === row.id),
    false,
  );
  await database
    .update(schema.reservationPipeline)
    .set({ status: "failed", nextRetryAt: null })
    .where(
      and(
        eq(schema.reservationPipeline.reservationId, row.id),
        eq(schema.reservationPipeline.step, "code_created"),
      ),
    );
  assert.equal(
    (await dueForRetry()).some((step) => step.reservationId === row.id),
    false,
  );
});
