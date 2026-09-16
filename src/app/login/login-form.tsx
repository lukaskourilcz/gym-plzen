"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { safeInternalPath } from "@/lib/security/redirects";
import { FREE_ENTRY_EVERY } from "@/lib/config/pricing";
import {
  CONFIGURED_OAUTH_PROVIDERS,
  type OAuthProviderId,
} from "@/lib/auth/oauth";
import { authenticateAction } from "./actions";

/**
 * Reasons `/auth/callback` can bounce a visitor back here. Without these the
 * failure is invisible: the visitor returns to a signed-out page and concludes
 * the provider button is broken.
 */
const CALLBACK_ERRORS: Record<string, string> = {
  odmitnuto: "Přihlášení přes externí účet bylo zrušeno.",
  vyprselo:
    "Přihlášení se nepodařilo dokončit. Zkuste to prosím znovu, nebo se přihlaste e-mailem a heslem.",
  selhalo: "Přihlášení přes externí účet se nepodařilo.",
  jiny_prohlizec:
    "Přihlášení se nepodařilo dokončit. Otevřete přímo www.navigym.cz a zkuste to znovu, nebo se přihlaste e-mailem a heslem.",
};

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
  providers?: readonly { id: OAuthProviderId; label: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeInternalPath(params.get("next"));

  const callbackError = CALLBACK_ERRORS[params.get("chyba") ?? ""] ?? null;
  /*
   * Where "continue without registration" goes. When the visitor was sent here
   * from the booking flow, `next` already points at the slot they picked, so we
   * return them to it; otherwise the calendar is the right place to start.
   */
  const guestHref = next.startsWith("/rezervace") ? next : "/rezervace";

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [serverError, setServerError] = useState<string | null>(callbackError);
  const [notice, setNotice] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    setReady(true);
  }, []);

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
      startNavigation(() => {
        router.push(result.destination ?? next);
        router.refresh();
      });
    }
  });

  return (
    <div>
      {providers.length > 0 && (
        <div className="grid gap-2.5">
          {providers.map((p) => (
            <a
              key={p.id}
              href={`/auth/signin?provider=${p.id}&next=${encodeURIComponent(next)}`}
              className={buttonVariants({
                variant: "outline",
                className: "h-[46px] w-full bg-card",
              })}
            >
              {p.label}
            </a>
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
          isSubmitting={formState.isSubmitting || isNavigating}
          disabled={!ready}
          pendingLabel={mode === "signin" ? "Přihlašuji…" : "Registruji…"}
          className="h-[50px] w-full"
        >
          {mode === "signin" ? "Přihlásit se" : "Zaregistrovat se"}
        </SubmitButton>
      </form>

      {mode === "signin" ? (
        <div className="mt-3 text-right">
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center text-sm font-bold text-accent-foreground hover:underline"
          >
            Zapomněli jste heslo?
          </Link>
        </div>
      ) : null}

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

      {/* A reservation no longer needs an account, so the login page has to say
          so and lead back to the booking flow the visitor came from. */}
      <div className="mt-6 border-t border-border pt-6">
        <Button
          href={guestHref}
          variant="outline"
          className="h-[46px] w-full bg-card"
        >
          Pokračovat bez registrace
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Rezervaci dokončíte i bez účtu. S účtem se vám počítá každý{" "}
          {FREE_ENTRY_EVERY}. vstup zdarma.
        </p>
      </div>
    </div>
  );
}
