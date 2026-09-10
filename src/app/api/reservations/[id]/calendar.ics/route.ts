import { getSession } from "@/lib/auth/guards";
import { booking, reservations } from "@/lib/services";
import { loadSiteContent, publicAddress } from "@/lib/content/site";
import { buildIcs, reservationCalendarEvent } from "@/lib/helpers/ics";

export const dynamic = "force-dynamic";

/**
 * The reservation as a calendar file.
 *
 * Authorisation mirrors the confirmation page exactly: either the caller is
 * signed in and owns the reservation, or they carry the random confirmation token that identifies a guest booking. Anything else is a 404
 * rather than a 403, so the endpoint never confirms that an id exists.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  const session = await getSession();
  const userId = session?.user.id ?? null;

  const slot = await resolveConfirmedSlot({ id, userId, token });
  if (!slot) return new Response("Not found", { status: 404 });

  const content = await loadSiteContent();
  const ics = buildIcs(
    reservationCalendarEvent({
      reservationId: id,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      address: publicAddress(content.get("contact.address")),
    }),
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rezervace.ics"',
      // Personal to one visitor and short-lived: never cached by a proxy.
      "Cache-Control": "private, no-store",
    },
  });
}

/** The slot times, but only for a caller who has actually proven access. */
async function resolveConfirmedSlot(params: {
  id: string;
  userId: string | null;
  token?: string;
}) {
  // Guest path (and the member's own redirect): the Checkout session, or a
  // free entry identified by its reservation id.
  const confirmation = await booking.getBookingConfirmation({
    userId: params.userId,
    token: params.token,
    reservationId: params.id,
  });
  if (
    confirmation.state === "confirmed" &&
    confirmation.reservationId === params.id
  ) {
    return { startsAt: confirmation.startsAt, endsAt: confirmation.endsAt };
  }

  // Member path: a paid reservation listed in the account has no session id in
  // the URL, so ownership is the proof.
  if (!params.userId) return null;
  const reservation = await reservations.getReservation(params.id);
  if (
    !reservation ||
    reservation.userId !== params.userId ||
    reservation.status !== "confirmed"
  ) {
    return null;
  }
  return { startsAt: reservation.startsAt, endsAt: reservation.endsAt };
}
