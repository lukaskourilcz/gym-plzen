"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth/client";
import { signUpSchema } from "@/lib/validations/auth";
import { Field, FormFeedback, SubmitButton } from "@/components/admin/form-controls";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Pokračovat přes Google",
  apple: "Pokračovat přes Apple",
  microsoft: "Pokračovat přes Microsoft",
};

// The form always carries name/email/password; `name` is only required in
// sign-up mode, enforced by superRefine so one form serves both modes.
const schema = z
  .object({ __mode: z.enum(["signin", "signup"]) })
  .and(signUpSchema.partial({ name: true }))
  .superRefine((val, ctx) => {
    if (val.__mode === "signup" && !val.name?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: "Zadejte jméno." });
    }
  });

type FormValues = z.infer<typeof schema>;

/**
 * Login / registration form (React Hook Form + Zod). Toggles between sign-in and
 * sign-up, supports OAuth providers, and redirects to the `next` param (or
 * /admin) on success.
 */
export function LoginForm({ socialProviders }: { socialProviders: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { __mode: "signin", email: "", password: "", name: "" },
  });

  function switchMode(newMode: "signin" | "signup") {
    setMode(newMode);
    setValue("__mode", newMode);
    setServerError(null);
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result =
      mode === "signin"
        ? await authClient.signIn.email({
            email: values.email,
            password: values.password,
          })
        : await authClient.signUp.email({
            email: values.email,
            password: values.password,
            name: values.name ?? "",
          });
    if (result.error) {
      setServerError(result.error.message ?? "Přihlášení se nezdařilo.");
    } else {
      router.push(next);
    }
  });

  async function onSocial(provider: string) {
    await authClient.signIn.social({ provider, callbackURL: next });
  }

  return (
    <div>
      {socialProviders.length > 0 && (
        <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
          {socialProviders.map((p) => (
            <button key={p} type="button" onClick={() => onSocial(p)}>
              {PROVIDER_LABELS[p] ?? p}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={onSubmit}>
        <input type="hidden" {...register("__mode")} />
        {mode === "signup" && (
          <Field name="name" label="Jméno" error={formState.errors.name}>
            <input id="name" {...register("name")} />
          </Field>
        )}
        <Field name="email" label="E-mail" error={formState.errors.email}>
          <input id="email" type="email" {...register("email")} />
        </Field>
        <Field name="password" label="Heslo" error={formState.errors.password}>
          <input id="password" type="password" {...register("password")} />
        </Field>

        <FormFeedback error={serverError} />
        <SubmitButton isSubmitting={formState.isSubmitting}>
          {mode === "signin" ? "Přihlásit se" : "Zaregistrovat se"}
        </SubmitButton>
      </form>

      <p style={{ marginTop: "1rem" }}>
        {mode === "signin" ? (
          <button type="button" onClick={() => switchMode("signup")} style={linkBtn}>
            Nemáte účet? Zaregistrujte se
          </button>
        ) : (
          <button type="button" onClick={() => switchMode("signin")} style={linkBtn}>
            Máte účet? Přihlaste se
          </button>
        )}
      </p>
    </div>
  );
}

const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--accent)",
  cursor: "pointer",
  padding: 0,
};
