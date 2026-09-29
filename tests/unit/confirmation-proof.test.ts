import assert from "node:assert/strict";
import test from "node:test";
import {
  CONFIRMATION_PROOF_MAX_AGE_SECONDS,
  confirmationProofCookieOptions,
  confirmationProofForBooking,
  confirmationProofFromUrl,
  serializeConfirmationProof,
} from "../../src/lib/helpers/confirmation-proof";

const orderId = "4356f140-1864-43a5-80f9-e27f8a6df17b";
const otherId = "5a76f140-1864-43a5-80f9-e27f8a6df17b";
const token = "a".repeat(64);

test("only an exact order or legacy reservation may reuse its saved proof", () => {
  const order = confirmationProofFromUrl(
    new URLSearchParams({ order_id: orderId, token }),
  );
  assert.deepEqual(order, { kind: "order", id: orderId, token });
  const cookie = serializeConfirmationProof(order!);
  assert.equal(confirmationProofForBooking(cookie, "order", orderId), token);
  assert.equal(
    confirmationProofForBooking(cookie, "order", otherId),
    undefined,
  );
  assert.equal(
    confirmationProofForBooking(cookie, "reservation", orderId),
    undefined,
  );
  const reservation = confirmationProofFromUrl(
    new URLSearchParams({ reservation_id: orderId, token }),
  );
  assert.equal(
    confirmationProofForBooking(
      serializeConfirmationProof(reservation!),
      "reservation",
      orderId,
    ),
    token,
  );
});

test("ambiguous, malformed and missing URL capabilities create no cookie", () => {
  for (const params of [
    new URLSearchParams({ order_id: orderId }),
    new URLSearchParams({ order_id: orderId, token: "short" }),
    new URLSearchParams({ order_id: "invalid", token }),
    new URLSearchParams({ order_id: orderId, reservation_id: otherId, token }),
  ])
    assert.equal(confirmationProofFromUrl(params), null);
  assert.equal(
    confirmationProofForBooking("invalid", "order", orderId),
    undefined,
  );
});

test("guest proof stays private, scoped to confirmation and short-lived", () => {
  const options = confirmationProofCookieOptions(true);
  assert.deepEqual(options, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/rezervace/hotovo",
    maxAge: CONFIRMATION_PROOF_MAX_AGE_SECONDS,
  });
  assert.equal(CONFIRMATION_PROOF_MAX_AGE_SECONDS, 24 * 60 * 60);
  assert.equal(confirmationProofCookieOptions(false).secure, false);
});
