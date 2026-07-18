"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

/** Sign out and return to the login page. */
export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="mt-1 text-primary hover:underline"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
      }}
    >
      Odhlásit se
    </button>
  );
}
