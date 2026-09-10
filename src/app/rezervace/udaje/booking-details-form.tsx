"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, TicketPercent } from "lucide-react";
import { Field, FormFeedback } from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  bookingDetailsSchema,
  type BookingDetailsValues,
} from "@/lib/validations/booking";
import { startCheckoutAction } from "../actions";
import { trackMetaEvent } from "@/lib/analytics/meta-pixel";
import { formatMoney } from "@/lib/helpers/format";
import type { VoucherQuote } from "@/lib/services/vouchers";
import { quoteVoucherAction } from "../actions";

/**
 * Booking details + the combined document consent, for members and guests
 * alike. A member arrives with their profile prefilled but still confirms it:
 * consent belongs to the reservation, not to the account.
 */
export function BookingDetailsForm({
  startsAtISO,
  entryPriceCents,
  defaultValues,
}: {
  startsAtISO: string;
  entryPriceCents: number;
  defaultValues: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherQuote, setVoucherQuote] = useState<VoucherQuote | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  /*
   * Submitting before hydration falls back to a native GET, which replaces the
   * `start` query parameter with the form fields and bounces the visitor back
   * to the calendar. Same guard the login form uses.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const { register, handleSubmit, formState, getValues, setValue } =
    useForm<BookingDetailsValues>({
      resolver: zodResolver(bookingDetailsSchema),
      defaultValues: {
        startsAt: startsAtISO,
        ...defaultValues,
        voucherCode: "",
        // `undefined` rather than `false`: an unticked box must fail validation,
        // and React needs the input to stay uncontrolled either way.
        acceptConditions: undefined,
      },
    });

  const voucherField = register("voucherCode");

  async function applyVoucher() {
    const code = getValues("voucherCode")?.trim() ?? "";
    setVoucherError(null);
    setVoucherQuote(null);
    if (!code) {
      setVoucherError("Zadejte kód voucheru.");
      return;
    }
    setVoucherLoading(true);
    const result = await quoteVoucherAction({ code, startsAt: startsAtISO });
    setVoucherLoading(false);
    if (!result.ok) {
      setVoucherError(result.error);
      return;
    }
    setValue("voucherCode", result.data.code, { shouldValidate: true });
    setVoucherQuote(result.data);
  }

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
      trackMetaEvent(
        "InitiateCheckout",
        { value: result.data.priceCents / 100, currency: "CZK" },
        `reservation:${result.data.reservationId}:checkout`,
      );
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
        Potvrzení a kód ke vstupu vám pošleme e-mailem. Zasílání přes WhatsApp
        si můžete zapnout ve svém profilu.
      </p>

      {entryPriceCents > 0 ? (
        <fieldset className="mt-7 border-t border-border pt-6">
          <legend className="flex items-center gap-2 text-sm font-extrabold">
            <TicketPercent
              aria-hidden="true"
              className="size-5 text-accent-foreground"
            />
            Máte voucher?
          </legend>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <label htmlFor="voucherCode" className="sr-only">
                Kód voucheru
              </label>
              <Input
                id="voucherCode"
                autoComplete="off"
                placeholder="Zadejte kód"
                aria-invalid={voucherError ? true : undefined}
                aria-describedby={voucherError ? "voucher-error" : undefined}
                {...voucherField}
                onChange={(event) => {
                  void voucherField.onChange(event);
                  setVoucherQuote(null);
                  setVoucherError(null);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={voucherLoading}
              onClick={() => void applyVoucher()}
              className="shrink-0"
            >
              {voucherLoading ? "Ověřuji…" : "Použít voucher"}
            </Button>
          </div>
          {voucherError ? (
            <p
              id="voucher-error"
              role="alert"
              className="mt-2 text-sm text-destructive"
            >
              {voucherError}
            </p>
          ) : null}
          {voucherQuote ? (
            <p role="status" className="mt-3 text-sm font-bold text-success">
              Voucher uplatněn. Sleva {formatMoney(voucherQuote.discountCents)},
              k platbě {formatMoney(voucherQuote.finalPriceCents)}.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="mt-7 border-t border-border pt-6">
        <legend className="sr-only">Souhlas s dokumenty</legend>
        <CombinedConsent
          error={formState.errors.acceptConditions?.message}
          register={register("acceptConditions")}
          rulesLink={
            <Link
              href="/provozni-rad"
              target="_blank"
              className="font-bold text-accent-foreground underline"
            >
              provozním řádem
            </Link>
          }
          termsLink={
            <Link
              href="/obchodni-podminky"
              target="_blank"
              className="font-bold text-accent-foreground underline"
            >
              obchodními podmínkami
            </Link>
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
 * One combined consent with two independent document links. `aria-labelledby`
 * gives the checkbox the complete sentence as its accessible name without
 * placing either interactive link inside the HTML label.
 */
function CombinedConsent({
  error,
  register,
  rulesLink,
  termsLink,
}: {
  error?: string;
  register: React.InputHTMLAttributes<HTMLInputElement>;
  rulesLink: React.ReactNode;
  termsLink: React.ReactNode;
}) {
  const name = "acceptConditions";
  return (
    <div>
      <div className="flex min-h-11 items-center gap-3 text-sm">
        <input
          id={name}
          type="checkbox"
          aria-labelledby={`${name}-label`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : undefined}
          // `accent-color` is the only thing a native checkbox honours here;
          // border and radius utilities would be inert.
          className="size-5 shrink-0 accent-[var(--color-primary)]"
          {...register}
        />
        <span id={`${name}-label`}>
          <label htmlFor={name}>Souhlasím s</label> {rulesLink} a {termsLink}.
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
