"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

/** Sign out and return to the login page. */
export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      style={{ marginTop: "0.5rem", background: "none", color: "var(--accent)", border: "none", padding: 0, cursor: "pointer" }}
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
      }}
    >
      Odhlásit se
    </button>
  );
}
