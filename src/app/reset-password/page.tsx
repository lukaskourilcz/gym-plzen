import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Nastavit nové heslo" };

export default async function ResetPasswordPage() {
  await requireUser("/reset-password");

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
        <p className="mt-2 text-sm text-muted-foreground">
          Zvolte nové heslo pro svůj účet.
        </p>
        <div className="mt-7">
          <ResetPasswordForm />
        </div>
      </div>
    </main>
  );
}
