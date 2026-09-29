"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  passwordUpdateSchema,
  type PasswordUpdateValues,
} from "@/lib/validations/auth";

const updatePasswordImpl = defineAction({
  schema: passwordUpdateSchema,
  authorize: getSession,
  handler: async (input, session) => {
    if (!session)
      throw new ActionError("Odkaz pro obnovu hesla už není platný.");
    const supabase = await createClient();
    if (!supabase) throw new ActionError("Změnu hesla teď nelze dokončit.");
    const { error } = await supabase.auth.updateUser({
      password: input.password,
    });
    if (error) throw new ActionError("Změnu hesla teď nelze dokončit.");
    revalidatePath("/account");
  },
});

export async function updatePasswordAction(
  input: PasswordUpdateValues,
): Promise<Result<unknown>> {
  return updatePasswordImpl(input);
}
