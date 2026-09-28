import { getSession } from "@/lib/auth/guards";
import { orders } from "@/lib/services";
import { loadSiteContent, publicAddress } from "@/lib/content/site";
import { buildIcs, reservationCalendarEvent } from "@/lib/helpers/ics";

export const dynamic = "force-dynamic";

/**
 * Every confirmed slot of an order as one calendar file, one event per slot.
 * Authorisation mirrors the confirmation page: the owner's account or the
 * order's random token. Anything else is a 404, so the endpoint never
 * confirms that an id exists.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? undefined;
  const session = await getSession();
  const confirmation = await orders.getOrderConfirmation({
    userId: session?.user.id ?? null,
    orderId: id,
    token,
  });
  if (confirmation.state !== "confirmed" || confirmation.slots.length === 0)
    return new Response("Not found", { status: 404 });

  const content = await loadSiteContent();
  const address = publicAddress(content.get("contact.address"));
  const ics = buildIcs(
    confirmation.slots.map((slot) =>
      reservationCalendarEvent({
        reservationId: slot.reservationId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        address,
      }),
    ),
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
