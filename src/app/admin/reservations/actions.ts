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
import { adminReservations, fulfillment } from "@/lib/services";

/**
 * Server actions for the reservations admin. Each: authorize (admin) → validate
 * (Zod, same schema as the client form) → convert form strings to domain types
 * → call the service → revalidate. Business logic stays in the service layer.
 */

const createImpl = defineAction({
  schema: createReservationSchema,
  authorize: assertAdmin,
  handler: async (input, admin) => {
    // The service refuses a past start and derives the end from the
    // configured window, so the form only chooses where the booking begins.
    const reservation = await adminReservations.createManualReservation({
      userId: input.userId || null,
      startsAt: formDateTimeToInstant(input.startsAt),
      contactName: input.contactName || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      priceCents: input.priceCents ?? null,
      admin: { id: admin.id, email: admin.email },
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
    // Refuses a reservation that has already ended; the shared cancellation
    // used by system paths is deliberately left without that rule.
    const current = await adminReservations.cancelByAdmin({
      id: input.id,
      reason: input.reason,
      admin: { id: admin.id, email: admin.email },
    });
    revalidatePath("/admin/reservations");
    if (current.userId) revalidatePath(`/admin/members/${current.userId}`);
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
