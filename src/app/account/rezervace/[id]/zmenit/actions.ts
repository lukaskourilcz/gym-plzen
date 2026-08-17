"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import { rescheduling } from "@/lib/services";
import {
  rescheduleReservationSchema,
  type RescheduleReservationValues,
} from "@/lib/validations/reservations";

async function assertMember() {
  const user = await getSessionUser();
  if (!user) throw new Error("Authenticated member required.");
  return user;
}

const rescheduleImpl = defineAction({
  schema: rescheduleReservationSchema,
  authorize: assertMember,
  handler: async (input, user) => {
    const moved = await rescheduling.rescheduleReservation({
      reservationId: input.reservationId,
      userId: user.id,
      startsAt: new Date(input.startsAt),
    });
    revalidatePath("/account");
    revalidatePath("/rezervace");
    revalidatePath(`/account/rezervace/${input.reservationId}/zmenit`);
    return {
      reservationId: moved.id,
      startsAt: moved.startsAt.toISOString(),
    };
  },
});

export async function rescheduleReservationAction(
  input: RescheduleReservationValues,
): Promise<Result<{ reservationId: string; startsAt: string }>> {
  return rescheduleImpl(input);
}
