import { Suspense } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení" };

/** Login / registration page — Supabase Auth (email/password + OAuth). */
export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(oklch(0.97_0.005_260/.035)_1px,transparent_1px),linear-gradient(90deg,oklch(0.97_0.005_260/.035)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(55%_55%_at_30%_100%,var(--color-primary),transparent_60%)]" />
        <Link href="/" className="relative inline-flex items-center gap-2.5 text-[17px] font-extrabold tracking-[-.02em]"><span className="grid size-[34px] place-items-center rounded-[9px] bg-primary text-primary-foreground"><Dumbbell className="size-5" /></span> GYM PLZEŇ</Link>
        <div className="relative"><div className="text-[40px] font-black leading-[1.08] tracking-[-.03em]">Váš gym.<br />Vaše hodina.<br /><em className="text-primary">Váš klid.</em></div><p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/65">Po přihlášení uvidíte své rezervace, věrnostní program a vstupní údaje na jednom místě.</p></div>
        <div className="relative text-xs text-white/40">Soukromý trénink · rezervace online</div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 font-extrabold lg:hidden">← Gym Plzeň</Link>
          <h1 className="text-[28px] font-black tracking-[-.025em]">Přihlášení</h1>
          <p className="mt-2 text-sm text-muted-foreground">Vítejte zpět. Přihlaste se a rezervujte.</p>
          <div className="mt-7">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
