import { Suspense } from "react";
import Link from "next/link";
import { BrandLogo, LotusMark } from "@/components/site/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení" };

/** Login / registration page : Supabase Auth (email/password + OAuth). */
export default function LoginPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen lg:grid-cols-2"
    >
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Link
          href="/"
          className="relative inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <BrandLogo inverse />
        </Link>
        <div className="relative">
          <LotusMark className="mb-8 size-16 text-primary" />
          <div className="text-[40px] font-black leading-[1.08] tracking-[-.03em]">
            Rezervace a vstupní údaje na jednom místě.
          </div>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/65">
            Po přihlášení najdete své termíny a informace potřebné k návštěvě.
          </p>
        </div>
        <div className="relative text-xs text-white/40">
          Soukromý trénink · rezervace online
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-10 inline-flex items-center gap-2 font-extrabold lg:hidden"
          >
            ← NAMASTÉ Private Gym
          </Link>
          <h1 className="text-[28px] font-black tracking-[-.025em]">
            Přihlášení
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Přihlaste se ke svým rezervacím.
          </p>
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
