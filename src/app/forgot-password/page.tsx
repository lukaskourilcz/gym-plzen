import Link from "next/link";
import { BrandLockup } from "@/components/site/brand";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Obnova hesla" };

export default function ForgotPasswordPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen lg:grid-cols-2"
    >
      <section className="relative hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Link
          href="/"
          aria-label="NAVI Private Gym, úvodní stránka"
          className="inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <BrandLockup className="w-56 text-gold" />
        </Link>
        <div>
          <h1 className="text-[40px] font-extrabold leading-[1.1] tracking-[-.01em]">
            Obnova hesla
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
            Pošleme vám bezpečný odkaz pro nastavení nového hesla.
          </p>
        </div>
        <div className="text-xs text-white/70">NAVI Private Gym</div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Link
            href="/login"
            className="mb-10 inline-flex min-h-11 items-center gap-2 font-extrabold hover:underline"
          >
            ← Zpět k přihlášení
          </Link>
          <h1 className="text-[28px] font-extrabold tracking-[-.01em]">
            Obnova hesla
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Zadejte e-mail k účtu. Pokud existuje, přijde vám odkaz pro změnu
            hesla.
          </p>
          <div className="mt-7">
            <ForgotPasswordForm />
          </div>
        </div>
      </section>
    </main>
  );
}
