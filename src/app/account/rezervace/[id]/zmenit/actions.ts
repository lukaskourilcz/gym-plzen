"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  startPricedReschedule,
  type ChangeOutcome,
} from "@/lib/services/priced-rescheduling";
import { randomUUID } from "node:crypto";
import { ActionError } from "@/lib/helpers/action";
import { CREDIT_TERMS_VERSION } from "@/lib/config/credits";
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
    if (input.changeTermsVersion !== CREDIT_TERMS_VERSION)
      throw new ActionError(
        "Pravidla změny termínu se aktualizovala. Obnovte stránku a potvrďte aktuální cenu a pravidla změny.",
      );
    if (input.quotedCents === undefined)
      throw new ActionError("Potvrďte cenu nového termínu.");
    const outcome = await startPricedReschedule({
      id: input.operationId ?? randomUUID(),
      userId: user.id,
      reservationId: input.reservationId,
      startsAt: new Date(input.startsAt),
      quotedCents: input.quotedCents,
      useCredits: input.useCredits ?? false,
      quotedCreditCents: input.quotedCreditCents,
    });
    revalidatePath("/account");
    revalidatePath("/rezervace");
    revalidatePath(`/account/rezervace/${input.reservationId}/zmenit`);
    return outcome;
  },
});

export async function rescheduleReservationAction(
  input: RescheduleReservationValues,
): Promise<Result<ChangeOutcome>> {
  return rescheduleImpl(input);
}
