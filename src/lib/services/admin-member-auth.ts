import { createClient } from "@supabase/supabase-js";
import { env, publicEnv } from "@/lib/env";
import { ActionError } from "@/lib/helpers/action";
import { createTimeoutFetch } from "@/lib/supabase/request-timeout";

export interface MemberAuthDirectory {
  getEmail(userId: string): Promise<string>;
  setEmail(userId: string, email: string): Promise<void>;
}

/** Server-only adapter. Never sends invites, recovery links or confirmation resends. */
export function memberAuthDirectory(): MemberAuthDirectory {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new ActionError(
      "Služba přihlašovacích účtů není dostupná. Údaje nebyly uloženy.",
    );
  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: createTimeoutFetch() },
  });
  const getEmail = async (userId: string) => {
    const { data, error } = await client.auth.admin.getUserById(userId);
    if (error || data.user?.id !== userId || !data.user.email)
      throw new ActionError(
        "Přihlašovací účet se nepodařilo ověřit. Zkuste to znovu.",
      );
    return data.user.email.trim().toLowerCase();
  };
  return {
    getEmail,
    async setEmail(userId, email) {
      const { data, error } = await client.auth.admin.updateUserById(userId, {
        email,
      });
      if (
        error &&
        [
          "email_exists",
          "email_address_conflict",
          "user_already_exists",
        ].includes(error.code ?? "")
      )
        throw new ActionError("Tento e-mail už používá jiný zákazník.");
      if (
        !error &&
        data.user?.id === userId &&
        data.user.email?.toLowerCase() === email
      )
        return;
      // A lost response may follow a successful update. Read back the same
      // identity instead of rolling it back or blindly issuing another write.
      if ((await getEmail(userId)) === email) return;
      throw new ActionError(
        "Přihlašovací e-mail se nepodařilo změnit. Zkontrolujte údaje a zkuste to znovu.",
      );
    },
  };
}
