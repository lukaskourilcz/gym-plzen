import {
  parseBookingHold,
  serializeBookingHold,
  type BookingHold,
} from "./booking-hold";

/** A guest can refresh their confirmation after the URL capability is hidden. */
export const CONFIRMATION_PROOF_COOKIE = "navi_confirmation";
export const CONFIRMATION_PROOF_PATH = "/rezervace/hotovo";
export const CONFIRMATION_PROOF_MAX_AGE_SECONDS = 24 * 60 * 60;

export function confirmationProofFromUrl(
  params: URLSearchParams,
): BookingHold | null {
  const token = params.get("token");
  const orderId = params.get("order_id");
  const reservationId = params.get("reservation_id");
  if (!token || Boolean(orderId) === Boolean(reservationId)) return null;
  return parseBookingHold(
    orderId ? `o.${orderId}.${token}` : `${reservationId}.${token}`,
  );
}

export function confirmationProofForBooking(
  value: string | null | undefined,
  kind: BookingHold["kind"],
  id: string | undefined,
): string | undefined {
  const proof = parseBookingHold(value);
  return proof?.kind === kind && proof.id === id ? proof.token : undefined;
}

export function confirmationProofCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: CONFIRMATION_PROOF_PATH,
    maxAge: CONFIRMATION_PROOF_MAX_AGE_SECONDS,
  };
}

export { serializeBookingHold as serializeConfirmationProof };
