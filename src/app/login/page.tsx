import { Suspense } from "react";
import Link from "next/link";
import { enabledSocialProviderIds } from "@/lib/auth/social-providers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata = { title: "Přihlášení" };

/** Login / registration page — email/password plus any configured OAuth providers. */
export default function LoginPage() {
  const providers = enabledSocialProviderIds();
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center font-bold tracking-tight">
          Gym Plzeň
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Přihlášení</CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm socialProviders={providers} />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
