"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/guards";
import {
  RECOVERY_GRANT_COOKIE,
  verifyRecoveryGrant,
} from "@/lib/auth/recovery-grant";
import { defineAction, ActionError } from "@/lib/helpers/action";
import type { Result } from "@/lib/helpers/result";
import {
  passwordUpdateSchema,
  type PasswordUpdateValues,
} from "@/lib/validations/auth";

/**
 * Set a new password without the current one. Allowed only with the signed
 * grant a recovery link leaves in this browser (see `recovery-grant.ts`): a
 * session on its own proves nothing about who is at the keyboard now.
 */
const updatePasswordImpl = defineAction({
  schema: passwordUpdateSchema,
  authorize: getSession,
  handler: async (input, session) => {
    if (!session)
      throw new ActionError("Odkaz pro obnovu hesla už není platný.");
    const cookieStore = await cookies();
    if (
      !verifyRecoveryGrant(
        cookieStore.get(RECOVERY_GRANT_COOKIE)?.value,
        session.user.id,
      )
    )
      throw new ActionError(
        "Odkaz pro obnovu hesla vypršel. Požádejte o nový, nebo si heslo změňte v účtu se současným heslem.",
      );
    const supabase = await createClient();
    if (!supabase) throw new ActionError("Změnu hesla teď nelze dokončit.");
    const { error } = await supabase.auth.updateUser({
      password: input.password,
    });
    if (error) throw new ActionError("Změnu hesla teď nelze dokončit.");
    // One recovery, one password change.
    cookieStore.delete(RECOVERY_GRANT_COOKIE);
    revalidatePath("/account");
  },
});

export async function updatePasswordAction(
  input: PasswordUpdateValues,
): Promise<Result<unknown>> {
  return updatePasswordImpl(input);
}
