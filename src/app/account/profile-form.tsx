"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { CustomerAvatar } from "@/components/site/customer-avatar";
import {
  profileSchema,
  changePasswordSchema,
  type ProfileValues,
} from "@/lib/validations/profile";
import { saveProfileAction, changePasswordAction } from "./actions";

export function ProfileForm({
  values,
  email,
  googlePhoto,
  isDemo,
}: {
  values: ProfileValues;
  email: string;
  googlePhoto: string | null;
  isDemo: boolean;
}) {
  const router = useRouter();
  const { form, submit, serverError, success } = useActionForm({
    schema: profileSchema,
    action: saveProfileAction,
    defaultValues: values,
    successMessage: "Profil byl uložen.",
    onSuccess: () => router.refresh(),
  });
  const { register, watch, formState } = form;
  const name = `${watch("firstName")} ${watch("lastName")}`;
  const usePhoto = watch("avatarSource") === "google" && googlePhoto;
  return (
    <section
      aria-labelledby="profile-heading"
      className="rounded-lg border border-border bg-card p-5 sm:p-8"
    >
      <h2 id="profile-heading" className="text-2xl font-extrabold">
        Osobní údaje
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Jméno a příjmení předvyplníme do nových rezervací a dokladů. Již
        vystavené doklady se nezmění.
      </p>
      <form onSubmit={submit} className="mt-6">
        <fieldset disabled={isDemo || formState.isSubmitting}>
          <legend className="sr-only">Údaje zákazníka</legend>
          <div className="mb-6 flex flex-wrap items-center gap-5">
            <CustomerAvatar name={name} photo={usePhoto ? googlePhoto : null} />
            <fieldset>
              <legend className="font-bold">Profilový obrázek</legend>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="radio"
                  value="initials"
                  {...register("avatarSource")}
                />{" "}
                Iniciály jména
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="radio"
                  value="google"
                  disabled={!googlePhoto}
                  {...register("avatarSource")}
                />{" "}
                Fotka z Googlu
              </label>
              {!googlePhoto ? (
                <p className="text-sm text-muted-foreground">
                  Dostupná u účtu přihlášeného přes Google.
                </p>
              ) : null}
            </fieldset>
          </div>
          <div className="grid gap-x-5 sm:grid-cols-2">
            <Field
              name="firstName"
              label="Jméno pro doklady"
              error={formState.errors.firstName}
            >
              <Input
                id="firstName"
                autoComplete="given-name"
                maxLength={60}
                {...register("firstName")}
              />
            </Field>
            <Field
              name="lastName"
              label="Příjmení pro doklady"
              error={formState.errors.lastName}
            >
              <Input
                id="lastName"
                autoComplete="family-name"
                maxLength={60}
                {...register("lastName")}
              />
            </Field>
            <Field name="profile-email" label="E-mail účtu">
              <Input
                id="profile-email"
                type="email"
                value={email}
                readOnly
                autoComplete="email"
              />
            </Field>
            <Field
              name="phone"
              label="Telefonní číslo"
              error={formState.errors.phone}
            >
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+420 777 123 456"
                {...register("phone")}
              />
            </Field>
          </div>
          <fieldset className="my-5 border-t border-border pt-5">
            <legend className="font-bold">Doručování vstupních kódů</legend>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked disabled className="size-4" />{" "}
              E-mailem vždy
            </label>
            <p className="mb-2 text-sm text-muted-foreground">
              Potvrzení rezervace a vstupní kódy posíláme vždy e-mailem. Tuto
              možnost nelze vypnout.
            </p>
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                className="size-4"
                {...register("notifyByWhatsapp")}
              />{" "}
              Také přes WhatsApp
            </label>
            <p className="text-sm text-muted-foreground">
              Kódy budeme navíc posílat na telefon uložený v profilu. Již
              odeslané kódy se změnou nastavení znovu neposílají.
            </p>
          </fieldset>
        </fieldset>
        <FormFeedback error={serverError} success={success} />
        <SubmitButton
          pendingLabel="Uložit profil…"
          className="mt-4"
          disabled={isDemo}
          isSubmitting={formState.isSubmitting}
        >
          Uložit profil
        </SubmitButton>
        {isDemo ? (
          <Notice className="mt-4">Ukázkový účet neukládá změny.</Notice>
        ) : null}
      </form>
    </section>
  );
}

export function PasswordForm({ isDemo }: { isDemo: boolean }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: changePasswordSchema,
    action: changePasswordAction,
    defaultValues: {
      currentPassword: "",
      password: "",
      passwordConfirmation: "",
    },
    successMessage:
      "Heslo bylo změněno. Při příštím přihlášení použijte nové heslo.",
    resetOnSuccess: true,
  });
  const { register, formState } = form;
  return (
    <section
      aria-labelledby="password-heading"
      className="rounded-lg border border-border bg-card p-5 sm:p-8"
    >
      <h2 id="password-heading" className="text-2xl font-extrabold">
        Změna hesla
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Použijte alespoň 8 znaků. Pokud se přihlašujete jen přes Google, nejdřív
        si{" "}
        <Link href="/forgot-password" className="font-bold underline">
          nastavte heslo e-mailem
        </Link>
        .
      </p>
      <form onSubmit={submit} className="mt-6 max-w-lg">
        <fieldset disabled={isDemo || formState.isSubmitting}>
          <legend className="sr-only">Změna přihlašovacího hesla</legend>
          <Field
            name="currentPassword"
            label="Současné heslo"
            error={formState.errors.currentPassword}
          >
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register("currentPassword")}
            />
          </Field>
          <Field
            name="password"
            label="Nové heslo"
            error={formState.errors.password}
          >
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>
          <Field
            name="passwordConfirmation"
            label="Nové heslo znovu"
            error={formState.errors.passwordConfirmation}
          >
            <Input
              id="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              {...register("passwordConfirmation")}
            />
          </Field>
        </fieldset>
        <FormFeedback error={serverError} success={success} />
        <SubmitButton
          pendingLabel="Změnit heslo…"
          className="mt-4"
          disabled={isDemo}
          isSubmitting={formState.isSubmitting}
        >
          Změnit heslo
        </SubmitButton>
        <Link
          href="/forgot-password"
          className="mt-3 flex min-h-11 w-fit items-center text-sm font-bold text-accent-foreground underline"
        >
          Zapomenuté heslo
        </Link>
      </form>
    </section>
  );
}
