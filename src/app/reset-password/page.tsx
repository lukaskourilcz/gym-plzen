import Link from "next/link";
import { getSessionUser } from "@/lib/auth/guards";
import { cookies } from "next/headers";
import {
  RECOVERY_PROOF_COOKIE,
  validRecoveryProof,
} from "@/lib/auth/recovery-proof";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nastavit nové heslo" };

export default async function ResetPasswordPage() {
  // A temporary Auth timeout must not send a verified recovery link to the
  // login form, where a customer who forgot their password cannot continue.
  const user = await getSessionUser();
  const cookieStore = await cookies();
  const hasRecoveryLink =
    user !== null &&
    validRecoveryProof(cookieStore.get(RECOVERY_PROOF_COOKIE)?.value, user.id);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen items-center justify-center px-6 py-12"
    >
      <div className="w-full max-w-[400px]">
        <Link
          href="/account"
          className="mb-10 inline-flex min-h-11 items-center gap-2 font-extrabold hover:underline"
        >
          ← Zpět do účtu
        </Link>
        <h1 className="text-[28px] font-extrabold tracking-[-.01em]">
          Nastavit nové heslo
        </h1>
        {hasRecoveryLink ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Zvolte nové heslo pro svůj účet.
            </p>
            <div className="mt-7">
              <ResetPasswordForm />
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Obnovovací odkaz nelze ověřit. Obnovte tuto stránku; pokud potíže
            trvají, požádejte o nový odkaz na přihlašovací stránce.
          </p>
        )}
      </div>
    </main>
  );
}
