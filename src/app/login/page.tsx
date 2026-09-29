import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/guards";
import { postLoginDestination } from "@/lib/security/redirects";
import { BrandLockup } from "@/components/site/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení" };

/**
 * Login and registration page using Supabase Auth (email/password + OAuth).
 * The public header links here for everyone (those pages are cached without a
 * session), so a visitor who is already signed in goes straight on to where
 * they were heading instead of being asked to log in again.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [session, params] = await Promise.all([getSession(), searchParams]);
  if (session) redirect(postLoginDestination(params.next, session.user.role));
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen lg:grid-cols-2"
    >
      <section className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Link
          href="/"
          aria-label="NAVI Private Gym, úvodní stránka"
          className="relative inline-flex min-h-11 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <BrandLockup className="w-56 text-gold" />
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
            ← NAVI Private Gym
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
