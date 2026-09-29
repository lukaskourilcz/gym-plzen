import { createClient } from "@supabase/supabase-js";
import { publicEnv, supabasePublicKey } from "@/lib/public-env";
import { ActionError } from "@/lib/helpers/action";
import type { ChangePasswordValues } from "@/lib/validations/profile";
import { createTimeoutFetch } from "@/lib/supabase/request-timeout";

/** Reauthenticate in an isolated, non-persistent session; never replace browser cookies. */
export async function changeCustomerPassword(
  user: { id: string; email: string },
  input: ChangePasswordValues,
) {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !supabasePublicKey)
    throw new ActionError("Změna hesla teď není dostupná.");
  const client = createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublicKey,
    {
      global: { fetch: createTimeoutFetch() },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (error || data.user?.id !== user.id)
    throw new ActionError(
      "Současné heslo není správné, nebo je přihlášení dočasně omezené.",
    );
  try {
    const { error: updateError } = await client.auth.updateUser({
      password: input.password,
      current_password: input.currentPassword,
    });
    if (updateError)
      throw new ActionError(
        "Heslo se nepodařilo změnit. Zvolte silnější heslo a zkuste to znovu.",
      );
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}
