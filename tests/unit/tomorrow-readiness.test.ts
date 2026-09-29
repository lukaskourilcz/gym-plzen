import assert from "node:assert/strict";
import test from "node:test";
import {
  checkTomorrowCode,
  checkTomorrowDelivery,
} from "../../src/lib/helpers/tomorrow-readiness";
import { hashCode } from "../../src/lib/helpers/crypto";

const startsAt = new Date("2026-10-01T08:00:00Z");
const now = new Date("2026-09-30T18:00:00Z");
const code = {
  status: "scheduled",
  provisionState: "ready",
  nukiAuthId: "auth-1",
  codeHash: hashCode("345678"),
  validFrom: startsAt,
  validUntil: new Date("2026-10-01T09:30:00Z"),
};
const nuki = {
  id: "auth-1",
  code: "345678",
  enabled: true,
  allowedFromDate: code.validFrom.toISOString(),
  allowedUntilDate: code.validUntil.toISOString(),
  allowedWeekDays: 127,
  allowedFromTime: 0,
  allowedUntilTime: 0,
  pending: false,
  rejected: false,
};

test("tomorrow check verifies the actual Nuki PIN and validity window", () => {
  assert.equal(checkTomorrowCode(startsAt, code, [nuki], now), "match");
  assert.equal(
    checkTomorrowCode(startsAt, code, [{ ...nuki, code: "987654" }], now),
    "mismatch",
  );
  assert.equal(
    checkTomorrowCode(startsAt, code, [{ ...nuki, enabled: false }], now),
    "mismatch",
  );
  assert.equal(
    checkTomorrowCode(
      startsAt,
      code,
      [{ ...nuki, allowedUntilDate: "2026-10-01T09:15:00Z" }],
      now,
    ),
    "mismatch",
  );
  assert.equal(checkTomorrowCode(startsAt, code, null, now), "unavailable");
});

test("a missing code is only an error after the 24-hour preparation point", () => {
  assert.equal(
    checkTomorrowCode(startsAt, null, [], new Date("2026-09-30T07:59:59Z")),
    "scheduled",
  );
  assert.equal(
    checkTomorrowCode(startsAt, null, [], new Date("2026-09-30T08:00:00Z")),
    "missing",
  );
  assert.equal(
    checkTomorrowCode(
      startsAt,
      { ...code, provisionState: "submitted" },
      [],
      now,
    ),
    "preparing",
  );
});

test("delivery waits until one hour before start and WhatsApp can be inapplicable", () => {
  assert.equal(
    checkTomorrowDelivery(
      startsAt,
      true,
      null,
      new Date("2026-10-01T06:59:59Z"),
    ),
    "scheduled",
  );
  assert.equal(
    checkTomorrowDelivery(
      startsAt,
      true,
      null,
      new Date("2026-10-01T07:00:00Z"),
    ),
    "pending",
  );
  assert.equal(checkTomorrowDelivery(startsAt, true, "sent", now), "sent");
  assert.equal(
    checkTomorrowDelivery(startsAt, false, null, now),
    "not_applicable",
  );
});

test("a PIN sent long before the promised hour is flagged, including when delivered", () => {
  const early = new Date("2026-09-20T10:30:00Z");
  assert.equal(
    checkTomorrowDelivery(startsAt, true, "sent", now, early),
    "sent_early",
  );
  assert.equal(
    checkTomorrowDelivery(startsAt, true, "delivered", now, early),
    "sent_early",
  );
  assert.equal(
    checkTomorrowDelivery(
      startsAt,
      true,
      "sent",
      now,
      new Date("2026-10-01T06:59:30Z"),
    ),
    "sent",
  );
});
