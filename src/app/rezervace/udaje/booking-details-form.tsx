"use client";

import { useState } from "react";
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
  dateKey,
  termsUrl,
  defaultValues,
}: {
  startsAtISO: string;
  dateKey: string;
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
        >
          Souhlasím s{" "}
          <Link
            href="/provozni-rad"
            target="_blank"
            className="font-bold text-accent-foreground underline"
          >
            provozním řádem
          </Link>
          .
        </Consent>
        <Consent
          name="acceptTerms"
          error={formState.errors.acceptTerms?.message}
          register={register("acceptTerms")}
        >
          Souhlasím s{" "}
          {termsUrl ? (
            <a
              href={termsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-accent-foreground underline"
            >
              obchodními podmínkami
            </a>
          ) : (
            <Link
              href="/obchodni-podminky"
              target="_blank"
              className="font-bold text-accent-foreground underline"
            >
              obchodními podmínkami
            </Link>
          )}
          .
        </Consent>
      </fieldset>

      <FormFeedback error={serverError} />

      <Button
        type="submit"
        size="lg"
        disabled={formState.isSubmitting}
        className="mt-6 w-full sm:w-auto"
      >
        {formState.isSubmitting ? "Připravuji platbu…" : "Pokračovat k platbě"}{" "}
        <ArrowRight aria-hidden="true" />
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        Termín {dateKey} držíme, dokud platbu nedokončíte nebo nevyprší.
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
  children,
}: {
  name: string;
  error?: string;
  register: React.InputHTMLAttributes<HTMLInputElement>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          id={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          className="size-5 shrink-0 rounded border-input accent-[var(--color-primary)]"
          {...register}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
