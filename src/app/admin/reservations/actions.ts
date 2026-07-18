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
import { reservations, fulfillment } from "@/lib/services";

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
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      contactName: input.contactName || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      priceCents: input.priceCents ?? null,
      status: "confirmed", // admin bookings are confirmed immediately
      createdByAdminId: admin.id,
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
    await reservations.cancelReservation({
      id: input.id,
      reason: input.reason || undefined,
      byAdminId: admin.id,
    });
    revalidatePath("/admin/reservations");
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
