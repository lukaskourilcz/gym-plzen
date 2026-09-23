import assert from "node:assert/strict";
import test from "node:test";
import { encryptPin, decryptPin } from "../../src/lib/helpers/pin-vault";
import {
  isAccessCodePreparationDue,
  accessCodePreparationAt,
} from "../../src/lib/config/access-code-delivery";
import { reservationAccessState } from "../../src/lib/helpers/reservation-access-state";
const key = "ab".repeat(32);
test("PIN encryption authenticates reservation identity, key and ciphertext", () => {
  const value = encryptPin("345678", "reservation-A:lock-1", key);
  assert.notEqual(value, encryptPin("345678", "reservation-A:lock-1", key));
  assert.ok(!value.includes("345678"));
  assert.equal(decryptPin(value, "reservation-A:lock-1", key), "345678");
  assert.throws(() => decryptPin(value, "reservation-B:lock-1", key));
  assert.throws(() =>
    decryptPin(value, "reservation-A:lock-1", "cd".repeat(32)),
  );
  assert.throws(() =>
    decryptPin(value.slice(0, -3) + "xyz", "reservation-A:lock-1", key),
  );
});
test("preparation starts exactly 24 elapsed hours before, including DST", () => {
  const starts = new Date("2026-10-25T10:00:00+01:00");
  const at = accessCodePreparationAt(starts);
  assert.equal(at.toISOString(), "2026-10-24T09:00:00.000Z");
  assert.equal(
    isAccessCodePreparationDue(starts, new Date(at.getTime() - 1)),
    false,
  );
  assert.equal(isAccessCodePreparationDue(starts, at), true);
});
test("admin separates scheduled generation, offline creation and revoked-slot risk", () => {
  const now = new Date("2026-10-01T10:00Z");
  const input = {
    status: "confirmed",
    startsAt: new Date("2026-10-03T10:00Z"),
    endsAt: new Date("2026-10-03T11:00Z"),
    hold: false,
    delivered: false,
    enabled: true,
  };
  assert.equal(
    reservationAccessState(input, now).at?.toISOString(),
    "2026-10-02T10:00:00.000Z",
  );
  assert.match(
    reservationAccessState({ ...input, status: "cancelled", hold: true }, now)
      .label,
    /blokovaný/,
  );
  assert.match(
    reservationAccessState(
      {
        ...input,
        code: {
          provisionState: "prepared",
          failureReason: "device_offline",
          revokeRequestedAt: null,
        },
      },
      now,
    ).label,
    /nedostupný/,
  );
});
