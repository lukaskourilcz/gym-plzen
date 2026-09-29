import type { Reservation } from "@/lib/db/types";
import { ActionError } from "@/lib/helpers/action";
import { formatDateTime } from "@/lib/helpers/format";
import { record as recordActivity } from "./activity";
import {
  cancelReservation,
  createReservation,
  getReservation,
} from "./reservations";
import { resolveConfiguredSlot } from "./slots";

/**
 * What an administrator may do to a reservation by hand, on top of the shared
 * reservation service. The rules here are the administration's own: system
 * paths (expired holds, closures, webhooks) keep calling `cancelReservation`
 * and `createReservation` directly.
 */

export interface AdminActor {
  id: string;
  email: string;
}

export const PAST_START_MESSAGE =
  "Začátek rezervace je v minulosti. Vyberte budoucí termín.";
export const OFF_GRID_MESSAGE =
  "Vybraný čas není začátkem žádného okna otevírací doby. Zvolte začátek okna podle nastavené otevírací doby.";
export const PAST_CANCEL_MESSAGE = "Rezervace už proběhla, zrušit ji nelze.";

/**
 * A walk-in or phone booking. The end is never taken from the form: it is the
 * configured window starting at `startsAt`, so a manual booking occupies
 * exactly one public slot and cannot leave a gap or straddle two.
 */
export async function createManualReservation(
  input: {
    startsAt: Date;
    userId?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    priceCents?: number | null;
    admin: AdminActor;
  },
  now = new Date(),
): Promise<Reservation> {
  if (input.startsAt.getTime() < now.getTime()) {
    throw new ActionError(PAST_START_MESSAGE);
  }
  const slot = await resolveConfiguredSlot(input.startsAt);
  if (!slot) throw new ActionError(OFF_GRID_MESSAGE);

  const reservation = await createReservation({
    userId: input.userId ?? null,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    contactPhone: input.contactPhone ?? null,
    priceCents: input.priceCents ?? null,
    status: "confirmed", // admin bookings are confirmed immediately
    createdByAdminId: input.admin.id,
  });
  await recordActivity({
    action: "reservation.created",
    actorType: "admin",
    actorId: input.admin.id,
    actorLabel: input.admin.email,
    memberId: reservation.userId,
    reservationId: reservation.id,
    summary: `Rezervace na ${formatDateTime(reservation.startsAt)} vytvořena ručně pro ${reservation.contactName ?? reservation.contactEmail ?? "neuvedený kontakt"}.`,
  });
  return reservation;
}

/** Whether the administration may still cancel this reservation. */
export function isCancellableByAdmin(
  row: Pick<Reservation, "status" | "endsAt">,
  now = new Date(),
): boolean {
  return row.status !== "cancelled" && row.endsAt.getTime() > now.getTime();
}

/**
 * Cancel from the reservations admin. A reservation that has already ended is
 * refused: cancelling it would e-mail the customer about a visit that took
 * place and raise a refund alert for money that is owed to the gym. The
 * optional reason is stored and sent to the customer in the cancellation
 * e-mail.
 */
export async function cancelByAdmin(
  input: { id: string; reason?: string | null; admin: AdminActor },
  now = new Date(),
): Promise<Reservation> {
  const current = await getReservation(input.id);
  if (!current) throw new ActionError("Rezervace nebyla nalezena.");
  if (current.status === "cancelled")
    throw new ActionError("Rezervace už je zrušená.");
  if (!isCancellableByAdmin(current, now))
    throw new ActionError(PAST_CANCEL_MESSAGE);

  const reason = input.reason?.trim() || undefined;
  await cancelReservation({
    id: current.id,
    reason,
    byAdminId: input.admin.id,
  });
  await recordActivity({
    action: "reservation.cancelled",
    actorType: "admin",
    actorId: input.admin.id,
    actorLabel: input.admin.email,
    memberId: current.userId,
    reservationId: current.id,
    summary: `Rezervace na ${formatDateTime(current.startsAt)} zrušena správcem${reason ? ` (${reason})` : ""}.`,
  });
  return current;
}
