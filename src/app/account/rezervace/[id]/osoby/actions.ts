"use server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guards";
import { defineAction } from "@/lib/helpers/action";
import { addParticipants } from "@/lib/services/participants";
import {
  addParticipantsSchema,
  type AddParticipantsValues,
} from "@/lib/validations/participants";

const impl = defineAction({
  schema: addParticipantsSchema,
  authorize: async () => {
    const user = await getSessionUser();
    if (!user || user.isDemo) throw new Error("Authenticated member required");
    return user;
  },
  handler: async (input, user) => {
    const outcome = await addParticipants({ ...input, userId: user.id });
    revalidatePath("/account");
    revalidatePath("/admin/calendar");
    revalidatePath("/admin/reservations");
    revalidatePath(`/account/rezervace/${input.reservationId}/osoby`);
    return outcome;
  },
});
export async function addParticipantsAction(input: AddParticipantsValues) {
  return impl(input);
}
