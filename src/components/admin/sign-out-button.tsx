"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { demoAdminLogoutAction } from "@/app/login/actions";

/** Sign out (Supabase Auth) and return to the login page. */
export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mt-1 text-primary hover:underline"
      onClick={async () => {
        await demoAdminLogoutAction();
        await createClient()?.auth.signOut();
        router.push("/login");
      }}
    >
      Odhlásit se
    </button>
  );
}
