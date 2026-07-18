import { Suspense } from "react";
import Link from "next/link";
import { Eye, LayoutDashboard, User } from "lucide-react";
import { isPreviewMode } from "@/lib/preview";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení" };

/**
 * Login / registration page — Supabase Auth (email/password + OAuth).
 * In client-preview mode the form is replaced by direct entrances: everything
 * is browsable without an account until Supabase is linked.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const preview = isPreviewMode();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center font-bold tracking-tight">
          Gym Plzeň
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{preview ? "Režim náhledu" : "Přihlášení"}</CardTitle>
          </CardHeader>
          <CardContent>
            {preview ? (
              <div>
                <p className="mb-5 flex items-start gap-2 text-sm text-muted-foreground">
                  <Eye className="mt-0.5 size-4 shrink-0" />
                  Přihlášení je zatím vypnuté — celý web i administrace jsou
                  volně přístupné, s ukázkovými daty. Zapne se po připojení
                  Supabase.
                </p>
                <div className="grid gap-2">
                  <Button href={next || "/account"}>
                    <User /> Pokračovat jako člen
                  </Button>
                  <Button href="/admin" variant="outline">
                    <LayoutDashboard /> Otevřít administraci
                  </Button>
                  <Button href="/" variant="ghost">
                    Zpět na web
                  </Button>
                </div>
              </div>
            ) : (
              <Suspense>
                <LoginForm />
              </Suspense>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
