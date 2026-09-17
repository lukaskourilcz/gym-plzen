import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingHoldCookieOptions,
  HOLD_COOKIE_MAX_AGE_SECONDS,
  parseBookingHold,
  serializeBookingHold,
} from "../../src/lib/helpers/booking-hold";

const hold = {
  reservationId: "4356f140-1864-43a5-80f9-e27f8a6df17b",
  token: "a".repeat(64),
};

test("the hold cookie round-trips a reservation id and its token", () => {
  assert.deepEqual(parseBookingHold(serializeBookingHold(hold)), hold);
});

test("anything that is not exactly an id and a 256-bit token is ignored", () => {
  assert.equal(parseBookingHold(undefined), null);
  assert.equal(parseBookingHold(""), null);
  assert.equal(parseBookingHold("not-a-cookie"), null);
  assert.equal(parseBookingHold(`${hold.reservationId}.short`), null);
  assert.equal(parseBookingHold(`${hold.reservationId}.${hold.token}.x`), null);
  assert.equal(parseBookingHold(`nope.${hold.token}`), null);
});

test("the cookie outlives the gateway's payment session, never the browser", () => {
  const options = bookingHoldCookieOptions(true);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.secure, true);
  assert.equal(options.path, "/rezervace");
  assert.equal(options.maxAge, HOLD_COOKIE_MAX_AGE_SECONDS);
  assert.ok(HOLD_COOKIE_MAX_AGE_SECONDS > 30 * 60);
  assert.equal(bookingHoldCookieOptions(false).secure, false);
});
