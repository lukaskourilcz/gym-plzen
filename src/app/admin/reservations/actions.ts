"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  cancelReservationSchema,
  createReservationSchema,
  type CreateReservationValues,
  type CancelReservationValues,
} from "@/lib/validations/reservations";
import { formDateTimeToInstant } from "@/lib/helpers/datetime";
import { activity, reservations, fulfillment } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";

/**
 * Server actions for the reservations admin. Each: authorize (admin) → validate
 * (Zod, same schema as the client form) → convert form strings to domain types
 * → call the service → revalidate. Business logic stays in the service layer.
 */

const createImpl = defineAction({
  schema: createReservationSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const reservation = await reservations.createReservation({
      userId: input.userId || null,
      startsAt: formDateTimeToInstant(input.startsAt),
      endsAt: formDateTimeToInstant(input.endsAt),
      contactName: input.contactName || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      priceCents: input.priceCents ?? null,
      status: "confirmed", // admin bookings are confirmed immediately
      createdByAdminId: admin.id,
    });
    await activity.record({
      action: "reservation.created",
      actorType: "admin",
      actorId: admin.id,
      actorLabel: admin.email,
      memberId: reservation.userId,
      reservationId: reservation.id,
      summary: `Rezervace na ${formatDateTime(reservation.startsAt)} vytvořena ručně pro ${reservation.contactName ?? reservation.contactEmail ?? "neuvedený kontakt"}.`,
    });
    // Provision + deliver the access code straight away.
    await fulfillment.fulfillReservation(reservation.id);
    revalidatePath("/admin/reservations");
  },
});

const cancelImpl = defineAction({
  schema: cancelReservationSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    const current = await reservations.getReservation(input.id);
    await reservations.cancelReservation({
      id: input.id,
      reason: input.reason || undefined,
      byAdminId: admin.id,
    });
    if (current)
      await activity.record({
        action: "reservation.cancelled",
        actorType: "admin",
        actorId: admin.id,
        actorLabel: admin.email,
        memberId: current.userId,
        reservationId: current.id,
        summary: `Rezervace na ${formatDateTime(current.startsAt)} zrušena správcem${input.reason ? ` (${input.reason})` : ""}.`,
      });
    revalidatePath("/admin/reservations");
    revalidatePath(`/admin/members/${current?.userId ?? ""}`);
  },
});

export async function createReservationAction(
  input: CreateReservationValues,
): Promise<Result<unknown>> {
  return createImpl(input);
}

export async function cancelReservationAction(
  input: CancelReservationValues,
): Promise<Result<unknown>> {
  return cancelImpl(input);
}
