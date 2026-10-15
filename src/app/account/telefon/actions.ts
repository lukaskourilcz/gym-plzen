"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/guards";
import { ActionError, defineAction } from "@/lib/helpers/action";
import { phoneSchema } from "@/lib/validations/common";
import { updateProfile } from "@/lib/services/members";

const schema = z.object({ phone: phoneSchema });
const save = defineAction({
  schema,
  authorize: async () => {
    const user = await getSessionUser();
    if (!user || user.isDemo)
      throw new ActionError("Přihlaste se ke svému účtu.");
    return user;
  },
  handler: async ({ phone }, user) => {
    await updateProfile(user.id, { phone });
    revalidatePath("/account");
    revalidatePath("/admin/members");
  },
});
export async function completePhoneAction(input: z.infer<typeof schema>) {
  return save(input);
}
