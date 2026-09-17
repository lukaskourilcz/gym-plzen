/**
 * The checkout-hold cookie.
 *
 * When a guest starts a paid booking, the browser keeps the reservation id and
 * the confirmation token for the length of the payment session. A return from
 * the gateway (the back button, a tab reopened from history) then finds the
 * visitor's own hold instead of a slot that merely looks taken, and the token
 * lets the booking continue exactly as it started. Members need none of this:
 * their hold is matched by account.
 *
 * Pure helpers only: reading and writing the cookie stays with the route and
 * the action, which own the request.
 */
export const HOLD_COOKIE = "navi_hold";

/** Slightly longer than the gateway's 30-minute payment session. */
export const HOLD_COOKIE_MAX_AGE_SECONDS = 35 * 60;

/** The cookie is only sent where the booking steps live. */
export const HOLD_COOKIE_PATH = "/rezervace";

export interface BookingHold {
  reservationId: string;
  token: string;
}

const RESERVATION_ID = /^[0-9a-f-]{36}$/i;
const TOKEN = /^[0-9a-f]{64}$/;

export function serializeBookingHold(hold: BookingHold): string {
  return `${hold.reservationId}.${hold.token}`;
}

/** A hold from the raw cookie value, or null for anything malformed. */
export function parseBookingHold(
  value: string | undefined | null,
): BookingHold | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [reservationId, token] = parts as [string, string];
  if (!RESERVATION_ID.test(reservationId) || !TOKEN.test(token)) return null;
  return { reservationId, token };
}

export function bookingHoldCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: HOLD_COOKIE_PATH,
    maxAge: HOLD_COOKIE_MAX_AGE_SECONDS,
  };
}
