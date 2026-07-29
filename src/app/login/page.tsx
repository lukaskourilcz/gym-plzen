import { Suspense } from "react";
import Link from "next/link";
import { LotusMark } from "@/components/site/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení" };

/** Login and registration page using Supabase Auth (email/password + OAuth). */
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
          aria-label="NAMASTÉ Private Gym, úvodní stránka"
          className="relative inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <LotusMark decorative className="size-24 text-gold" />
        </Link>
        <div className="relative">
          <div className="text-[40px] font-extrabold leading-[1.1] tracking-[-.01em]">
            Klientská zóna
          </div>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/70">
            Po přihlášení najdete své zarezervované termíny a můžete sledovat
            své pokroky.
          </p>
        </div>
        <div className="relative text-xs text-white/70">
          Soukromý trénink · rezervace online
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-10 inline-flex min-h-11 items-center gap-2 font-extrabold lg:hidden"
          >
            ← NAMASTÉ Private Gym
          </Link>
          <h1 className="text-[28px] font-extrabold tracking-[-.01em]">
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
