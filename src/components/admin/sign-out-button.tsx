"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Sign out (Supabase Auth) and return to the login page. */
export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mt-1 text-primary hover:underline"
      onClick={async () => {
        await createClient()?.auth.signOut();
        router.push("/login");
      }}
    >
      Odhlásit se
    </button>
  );
}
