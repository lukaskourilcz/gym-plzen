"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { Field, FormFeedback } from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  bookingDetailsSchema,
  type BookingDetailsValues,
} from "@/lib/validations/booking";
import { startCheckoutAction } from "../actions";

/**
 * Booking details + the two consents, for members and guests alike. A member
 * arrives with their profile prefilled but still ticks the consents: they
 * belong to the reservation, not to the account.
 */
export function BookingDetailsForm({
  startsAtISO,
  termsUrl,
  defaultValues,
}: {
  startsAtISO: string;
  termsUrl: string | null;
  defaultValues: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  /*
   * Submitting before hydration falls back to a native GET, which replaces the
   * `start` query parameter with the form fields and bounces the visitor back
   * to the calendar. Same guard the login form uses.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const { register, handleSubmit, formState } = useForm<BookingDetailsValues>({
    resolver: zodResolver(bookingDetailsSchema),
    defaultValues: {
      startsAt: startsAtISO,
      ...defaultValues,
      // `undefined` rather than `false`: an unticked box must fail validation,
      // and React needs the input to stay uncontrolled either way.
      acceptRules: undefined,
      acceptTerms: undefined,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const result = await startCheckoutAction(values);
    if (!result.ok) {
      setServerError(result.error);
      // The slot may have gone in the meantime; refresh so the calendar behind
      // this step is not stale when the visitor goes back.
      router.refresh();
      return;
    }
    if (result.data.kind === "checkout") {
      window.location.href = result.data.url;
      return;
    }
    router.push(
      `/rezervace/hotovo?reservation_id=${result.data.reservationId}`,
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <input type="hidden" {...register("startsAt")} />

      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field
          name="firstName"
          label="Jméno"
          error={formState.errors.firstName}
        >
          <Input
            id="firstName"
            autoComplete="given-name"
            {...register("firstName")}
          />
        </Field>
        <Field
          name="lastName"
          label="Příjmení"
          error={formState.errors.lastName}
        >
          <Input
            id="lastName"
            autoComplete="family-name"
            {...register("lastName")}
          />
        </Field>
      </div>
      <Field name="email" label="E-mail" error={formState.errors.email}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vas@email.cz"
          {...register("email")}
        />
      </Field>
      <Field name="phone" label="Telefon" error={formState.errors.phone}>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="+420 777 123 456"
          {...register("phone")}
        />
      </Field>
      <p className="-mt-2 text-xs text-muted-foreground">
        Na e-mail a telefon vám pošleme potvrzení a kód ke vstupu.
      </p>

      <fieldset className="mt-7 border-t border-border pt-6">
        <legend className="sr-only">Souhlasy</legend>
        <Consent
          name="acceptRules"
          error={formState.errors.acceptRules?.message}
          register={register("acceptRules")}
          label="Souhlasím s provozním řádem"
          document={
            <Link
              href="/provozni-rad"
              target="_blank"
              className="font-bold text-accent-foreground underline"
            >
              (otevřít provozní řád)
            </Link>
          }
        />
        <Consent
          name="acceptTerms"
          error={formState.errors.acceptTerms?.message}
          register={register("acceptTerms")}
          label="Souhlasím s obchodními podmínkami"
          document={
            termsUrl ? (
              <a
                href={termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-accent-foreground underline"
              >
                (otevřít obchodní podmínky)
              </a>
            ) : (
              <Link
                href="/obchodni-podminky"
                target="_blank"
                className="font-bold text-accent-foreground underline"
              >
                (otevřít obchodní podmínky)
              </Link>
            )
          }
        />
      </fieldset>

      <FormFeedback error={serverError} />

      <Button
        type="submit"
        size="lg"
        disabled={!ready || formState.isSubmitting}
        className="mt-6 w-full sm:w-auto"
      >
        {formState.isSubmitting ? "Připravuji platbu…" : "Pokračovat k platbě"}{" "}
        <ArrowRight aria-hidden="true" />
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        Termín vám držíme, dokud platbu nedokončíte nebo dokud platební relace
        nevyprší.
      </p>
    </form>
  );
}

/**
 * A consent row: 44px target, the checkbox labelled by its own text, and the
 * error wired to the input so a screen reader hears why it cannot continue.
 */
function Consent({
  name,
  error,
  register,
  label,
  document: documentLink,
}: {
  name: string;
  error?: string;
  register: React.InputHTMLAttributes<HTMLInputElement>;
  /** Plain text; it is the checkbox's whole accessible name. */
  label: string;
  /** The link to the document being agreed to, rendered beside the label. */
  document: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex min-h-11 items-center gap-3 text-sm">
        <input
          id={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          // `accent-color` is the only thing a native checkbox honours here;
          // border and radius utilities would be inert.
          className="size-5 shrink-0 accent-[var(--color-primary)]"
          {...register}
        />
        {/*
         * `label` deliberately wraps only the text. A `<label>` may not contain
         * an interactive element: the link would be swallowed into the
         * checkbox's accessible name and clicking it would behave differently
         * from browser to browser.
         */}
        <span>
          <label htmlFor={name}>{label}</label> {documentLink}.
        </span>
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
