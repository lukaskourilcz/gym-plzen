"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { demoAdminLogoutAction } from "@/app/login/actions";
import { cn } from "@/lib/utils";

/** Sign out (Supabase Auth) and return to the login page. */
export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={cn("mt-1 text-primary hover:underline", className)}
      onClick={async () => {
        await demoAdminLogoutAction();
        router.replace("/login");
        try {
          await createClient()?.auth.signOut();
        } finally {
          router.refresh();
        }
      }}
    >
      Odhlásit se
    </button>
  );
}
