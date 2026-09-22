import assert from "node:assert/strict";
import test from "node:test";
import {
  accessCodeDeliveryAt,
  isAccessCodeDeliveryDue,
  accessCodeValidity,
} from "../../src/lib/config/access-code-delivery";

const start = new Date("2026-10-01T08:00:00Z");
test("PIN delivery waits until exactly one hour before the reservation", () => {
  assert.equal(
    accessCodeDeliveryAt(start).toISOString(),
    "2026-10-01T07:00:00.000Z",
  );
  assert.equal(
    isAccessCodeDeliveryDue(start, new Date("2026-09-20T10:00:00Z")),
    false,
  );
  assert.equal(
    isAccessCodeDeliveryDue(start, new Date("2026-10-01T06:59:59.999Z")),
    false,
  );
  assert.equal(
    isAccessCodeDeliveryDue(start, new Date("2026-10-01T07:00:00Z")),
    true,
  );
});
test("last-minute confirmations are eligible immediately", () => {
  assert.equal(
    isAccessCodeDeliveryDue(start, new Date("2026-10-01T07:45:00Z")),
    true,
  );
});
test("one hour means elapsed time across daylight-saving transitions", () => {
  const afterClockChange = new Date("2026-10-25T02:30:00+01:00");
  assert.equal(
    accessCodeDeliveryAt(afterClockChange).toISOString(),
    "2026-10-25T00:30:00.000Z",
  );
  assert.equal(
    isAccessCodeDeliveryDue(afterClockChange, new Date("2026-10-25T00:29:59Z")),
    false,
  );
});

test("entry validity is reservation start through end plus shower grace, independent of email time", () => {
  const startsAt = new Date("2026-09-20T12:45:00+02:00");
  const endsAt = new Date("2026-09-20T13:45:00+02:00");
  const window = accessCodeValidity(startsAt, endsAt, 15);
  assert.equal(window.validFrom.toISOString(), "2026-09-20T10:45:00.000Z");
  assert.equal(window.validUntil.toISOString(), "2026-09-20T12:00:00.000Z");
  assert.equal(
    accessCodeDeliveryAt(startsAt).getTime(),
    window.validFrom.getTime() - 60 * 60_000,
  );
  assert.equal(startsAt.toISOString(), "2026-09-20T10:45:00.000Z");
});
