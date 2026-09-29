import Link from "next/link";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/guards";
import {
  RECOVERY_GRANT_COOKIE,
  verifyRecoveryGrant,
} from "@/lib/auth/recovery-grant";
import { Notice } from "@/components/ui/notice";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nastavit nové heslo" };

export default async function ResetPasswordPage() {
  const user = await requireUser("/reset-password");
  // Without the proof a recovery link leaves behind, a signed-in session may
  // change the password only with the current one, on the account page.
  const recovered = verifyRecoveryGrant(
    (await cookies()).get(RECOVERY_GRANT_COOKIE)?.value,
    user.id,
  );

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
        {recovered ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              Zvolte nové heslo pro svůj účet.
            </p>
            <div className="mt-7">
              <ResetPasswordForm />
            </div>
          </>
        ) : (
          <Notice tone="info" className="mt-5">
            Nové heslo lze bez současného nastavit do 15 minut po otevření
            odkazu pro obnovu hesla, a to v prohlížeči, ve kterém jste odkaz
            otevřeli. Požádejte o{" "}
            <Link href="/forgot-password" className="font-bold underline">
              nový odkaz
            </Link>
            , nebo si heslo změňte{" "}
            <Link href="/account" className="font-bold underline">
              v účtu
            </Link>{" "}
            se současným heslem.
          </Notice>
        )}
      </div>
    </main>
  );
}
