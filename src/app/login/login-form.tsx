"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/security/redirects";
import { publicEnv } from "@/lib/public-env";
import { authenticateAction } from "./actions";

/** OAuth providers shown as buttons (enable each in the Supabase dashboard). */
const OAUTH_PROVIDERS: { id: "google" | "apple" | "azure"; label: string }[] = [
  { id: "google", label: "Pokračovat přes Google" },
  { id: "apple", label: "Pokračovat přes Apple" },
  { id: "azure", label: "Pokračovat přes Microsoft" },
];

const enabledOAuthProviders = new Set(
  (publicEnv.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean),
);
const CONFIGURED_OAUTH_PROVIDERS = OAUTH_PROVIDERS.filter((provider) =>
  enabledOAuthProviders.has(provider.id),
);

// One flat schema serves both modes; `name` is only required in sign-up.
const schema = z
  .object({
    __mode: z.enum(["signin", "signup"]),
    name: z.string().max(120).optional(),
    email: z.string().email("Neplatný e-mail."),
    password: z.string().min(8, "Heslo musí mít alespoň 8 znaků."),
  })
  .refine((val) => val.__mode === "signin" || Boolean(val.name?.trim()), {
    path: ["name"],
    message: "Zadejte jméno.",
  });

type FormValues = z.infer<typeof schema>;

/**
 * Login / registration form (React Hook Form + Zod) backed by Supabase Auth.
 * Toggles between sign-in and sign-up and supports OAuth providers.
 */
export function LoginForm({
  providers = CONFIGURED_OAUTH_PROVIDERS,
}: {
  providers?: typeof OAUTH_PROVIDERS;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"));

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthPending, setOauthPending] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { __mode: "signin", email: "", password: "", name: "" },
  });

  function switchMode(newMode: "signin" | "signup") {
    setMode(newMode);
    setValue("__mode", newMode);
    setServerError(null);
    setNotice(null);
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    setNotice(null);

    const result = await authenticateAction({
      mode,
      name: values.name,
      email: values.email,
      password: values.password,
      next,
    });
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    if (result.confirmationRequired) {
      setNotice(
        "Účet je připravený. Dokončete registraci přes odkaz v e-mailu.",
      );
    } else {
      router.push(result.destination ?? next);
      router.refresh();
    }
  });

  async function onOAuth(provider: (typeof OAUTH_PROVIDERS)[number]["id"]) {
    if (oauthPending) return;
    setServerError(null);
    setNotice(null);
    const supabase = createClient();
    if (!supabase) {
      setServerError(
        "Externí přihlášení teď není dostupné. Použijte prosím e-mail a heslo.",
      );
      return;
    }
    setOauthPending(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (!error) return;
      setServerError("Přihlášení přes externí účet se nepodařilo spustit.");
    } catch {
      setServerError("Přihlášení přes externí účet se nepodařilo spustit.");
    }
    setOauthPending(null);
  }

  return (
    <div>
      {providers.length > 0 && (
        <div className="grid gap-2.5">
          {providers.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="outline"
              className="h-[46px] bg-card"
              onClick={() => onOAuth(p.id)}
              disabled={Boolean(oauthPending)}
              aria-busy={oauthPending === p.id}
            >
              {oauthPending === p.id ? "Přesměrovávám…" : p.label}
            </Button>
          ))}
        </div>
      )}

      {providers.length > 0 && (
        <div className="my-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.1em] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          nebo e-mailem
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      <form onSubmit={onSubmit}>
        <input type="hidden" {...register("__mode")} />
        {mode === "signup" && (
          <Field name="name" label="Jméno" error={formState.errors.name}>
            <Input id="name" autoComplete="name" {...register("name")} />
          </Field>
        )}
        <Field name="email" label="E-mail" error={formState.errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="vas@email.cz"
            {...register("email")}
          />
        </Field>
        <Field name="password" label="Heslo" error={formState.errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            placeholder="••••••••"
            {...register("password")}
          />
        </Field>

        <FormFeedback error={serverError} success={notice} />
        <SubmitButton
          isSubmitting={formState.isSubmitting}
          className="h-[50px] w-full"
        >
          {mode === "signin" ? "Přihlásit se" : "Zaregistrovat se"}
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          className="inline-flex min-h-11 items-center font-bold text-foreground hover:underline"
        >
          {mode === "signin"
            ? "Nemáte účet? Zaregistrujte se"
            : "Máte účet? Přihlaste se"}
        </button>
      </p>
    </div>
  );
}
