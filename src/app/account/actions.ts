"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guards";
import { ActionError, defineAction } from "@/lib/helpers/action";
import { takeRateLimit } from "@/lib/security/rate-limit";
import { saveCustomerProfile } from "@/lib/services/customer-profile";
import { changeCustomerPassword } from "@/lib/services/customer-password";
import {
  profileSchema,
  changePasswordSchema,
  type ProfileValues,
  type ChangePasswordValues,
} from "@/lib/validations/profile";

async function authorizeCustomer() {
  const user = await getSessionUser();
  if (!user || user.isDemo)
    throw new ActionError("Pro tuto změnu se přihlaste ke svému účtu.");
  return user;
}

const saveProfile = defineAction({
  schema: profileSchema,
  authorize: authorizeCustomer,
  handler: async (input, user) => {
    if (input.avatarSource === "google" && !user.googleAvatarUrl)
      throw new ActionError("Účet nemá dostupnou profilovou fotku z Googlu.");
    await saveCustomerProfile(user.id, input);
    revalidatePath("/account");
    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${user.id}`);
    revalidatePath("/rezervace/udaje");
  },
});
export async function saveProfileAction(input: ProfileValues) {
  return saveProfile(input);
}

const changePassword = defineAction({
  schema: changePasswordSchema,
  authorize: authorizeCustomer,
  handler: async (input, user) => {
    if (
      !takeRateLimit("change-password", user.id, {
        limit: 5,
        windowMs: 15 * 60_000,
      })
    )
      throw new ActionError("Příliš mnoho pokusů. Zkuste to za 15 minut.");
    await changeCustomerPassword(user, input);
  },
});
export async function changePasswordAction(input: ChangePasswordValues) {
  return changePassword(input);
}
