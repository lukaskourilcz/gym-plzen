import { Suspense } from "react";
import { enabledSocialProviderIds } from "@/lib/auth/social-providers";
import { LoginForm } from "./login-form";

/**
 * Login / registration page. Renders email/password plus whichever OAuth
 * providers are configured. Visual design is deferred; this is functional.
 */
export default function LoginPage() {
  const providers = enabledSocialProviderIds();
  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Přihlášení</h1>
      <Suspense>
        <LoginForm socialProviders={providers} />
      </Suspense>
    </main>
  );
}
