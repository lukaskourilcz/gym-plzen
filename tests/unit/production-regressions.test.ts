import assert from "node:assert/strict";
import test from "node:test";
import { generateKeypadCode } from "../../src/lib/helpers/crypto";
import { adminDateTimeToInstant } from "../../src/lib/helpers/datetime";
import { databaseErrorCode } from "../../src/lib/helpers/database-error";
import { resolveSlotFromHours } from "../../src/lib/services/slots";
import {
  openingHoursSchema,
  createBlockedSlotSchema,
} from "../../src/lib/validations/schedule";

test("every generated PIN satisfies the Nuki keypad rules", () => {
  for (let i = 0; i < 10_000; i++) {
    const pin = generateKeypadCode();
    assert.match(pin, /^[1-9]{6}$/);
    assert.equal(pin.startsWith("12"), false);
  }
});

test("admin wall times remain Prague instants across winter and summer", () => {
  assert.equal(
    adminDateTimeToInstant("2026-01-01T10:00").toISOString(),
    "2026-01-01T09:00:00.000Z",
  );
  assert.equal(
    adminDateTimeToInstant("2026-07-01T10:00").toISOString(),
    "2026-07-01T08:00:00.000Z",
  );
  assert.equal(
    adminDateTimeToInstant("2026-07-01T10:00:00+02:00").toISOString(),
    "2026-07-01T08:00:00.000Z",
  );
  for (const invalid of [
    "2026-02-31T10:00:00Z",
    "2026-03-29T02:30",
    "2026-09-07T99:00",
    "2026-09-07",
    "2026-09-07T12:00junk",
  ]) {
    assert.throws(() => adminDateTimeToInstant(invalid));
  }
});

test("admin range validation compares actual instants even for mixed offsets", () => {
  assert.equal(
    createBlockedSlotSchema.safeParse({
      startsAt: "2026-07-01T10:00",
      endsAt: "2026-07-01T08:30:00Z",
      reason: "maintenance",
    }).success,
    true,
  );
  assert.equal(
    createBlockedSlotSchema.safeParse({
      startsAt: "2026-07-01T10:00",
      endsAt: "2026-07-01T07:30:00Z",
      reason: "maintenance",
    }).success,
    false,
  );
  const hours = {
    dayOfWeek: 1,
    open: "10:00",
    close: "09:00",
    slotMinutes: 75,
    isClosed: false,
  };
  assert.equal(openingHoursSchema.safeParse(hours).success, false);
  assert.equal(
    openingHoursSchema.safeParse({ ...hours, isClosed: true }).success,
    true,
  );
  assert.equal(
    openingHoursSchema.safeParse({ ...hours, open: "99:00" }).success,
    false,
  );
});

test("forged sub-minute slots cannot bypass the booking grid", () => {
  const hours = {
    openMinute: 300,
    closeMinute: 1425,
    slotMinutes: 75,
    isClosed: false,
  };
  assert.ok(resolveSlotFromHours(new Date("2026-07-01T03:00:00Z"), hours));
  assert.equal(
    resolveSlotFromHours(new Date("2026-07-01T03:00:01Z"), hours),
    null,
  );
  assert.equal(
    resolveSlotFromHours(new Date("2026-07-01T03:00:00.001Z"), hours),
    null,
  );
  assert.equal(resolveSlotFromHours(new Date("invalid"), hours), null);
});

test("wrapped database constraints retain their actionable SQLSTATE", () => {
  assert.equal(
    databaseErrorCode(new Error("Drizzle query", { cause: { code: "23P01" } })),
    "23P01",
  );
  assert.equal(
    databaseErrorCode({ cause: { cause: { code: "23505" } } }),
    "23505",
  );
  assert.equal(databaseErrorCode(null), undefined);
});
