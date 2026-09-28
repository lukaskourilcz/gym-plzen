/**
 * The checkout-hold cookie.
 *
 * When a guest starts a paid booking, the browser keeps the order id (or, for
 * a hold made before multi-slot orders, the reservation id) and the
 * confirmation token for the length of the payment session. A return from
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
  /** An order holds every slot of one checkout; a reservation is the older form. */
  kind: "order" | "reservation";
  id: string;
  token: string;
}

const ID = /^[0-9a-f-]{36}$/i;
const TOKEN = /^[0-9a-f]{64}$/;
const ORDER_PREFIX = "o";

export function serializeBookingHold(hold: BookingHold): string {
  return hold.kind === "order"
    ? `${ORDER_PREFIX}.${hold.id}.${hold.token}`
    : `${hold.id}.${hold.token}`;
}

/** A hold from the raw cookie value, or null for anything malformed. */
export function parseBookingHold(
  value: string | undefined | null,
): BookingHold | null {
  if (!value) return null;
  const parts = value.split(".");
  const kind =
    parts.length === 3 && parts[0] === ORDER_PREFIX
      ? "order"
      : parts.length === 2
        ? "reservation"
        : null;
  if (!kind) return null;
  const [id, token] = parts.slice(-2) as [string, string];
  if (!ID.test(id) || !TOKEN.test(token)) return null;
  return { kind, id, token };
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
