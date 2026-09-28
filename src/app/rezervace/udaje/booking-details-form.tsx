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
import { receiveAction } from "@/lib/helpers/action-response";

function reportTransportError(error: unknown, where: string) {
  // Load monitoring only after a failure; reporting must never block recovery.
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs")
    .then(({ captureException }) =>
      captureException(error, { tags: { operation: where } }),
    )
    .catch(() => {});
}

/**
 * Booking details + the combined document consent, for members and guests
 * alike, for every selected slot at once. A member arrives with their profile
 * prefilled but still confirms it: consent belongs to the reservation, not to
 * the account.
 */
export function BookingDetailsForm({
  paymentsAvailable = true,
  startsISO,
  totalCents,
  blocked = false,
  canSavePhone = false,
  defaultValues,
}: {
  paymentsAvailable?: boolean;
  /** The bookable slots of the selection, in start order. */
  startsISO: string[];
  /** What the selection costs before a voucher, loyalty rewards applied. */
  totalCents: number;
  /** A selected slot must be removed before the order can be placed. */
  blocked?: boolean;
  /** A signed-in member has a profile the number can be kept in; a guest does not. */
  canSavePhone?: boolean;
  defaultValues: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [checkoutInterrupted, setCheckoutInterrupted] = useState(false);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherQuote, setVoucherQuote] = useState<VoucherQuote | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  /*
   * Submitting before hydration falls back to a native GET, which replaces the
   * `start` query parameters with the form fields and bounces the visitor back
   * to the calendar. Same guard the login form uses.
   */
  const [ready, setReady] = useState(false);
  /*
   * Once the gateway URL is known the button stays disabled: the browser is
   * on its way there, and a second click would submit the same booking again.
   * A page restored from the back-forward cache (the back button from the
   * gateway) keeps its state, so the button is released again there.
   */
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    setReady(true);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setRedirecting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  const { register, handleSubmit, formState, getValues, setValue } =
    useForm<BookingDetailsValues>({
      resolver: zodResolver(bookingDetailsSchema),
      defaultValues: {
        starts: startsISO,
        ...defaultValues,
        voucherCode: "",
        // Keeping the number is the member's choice, so it starts unticked.
        savePhone: false,
        // `undefined` rather than `false`: an unticked box must fail validation,
        // and React needs the input to stay uncontrolled either way.
        acceptConditions: undefined,
      },
    });

  const effectivePriceCents = voucherQuote?.finalPriceCents ?? totalCents;
  const voucherUnavailable = !paymentsAvailable && totalCents > 0;
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
    const response = await receiveAction(() =>
      quoteVoucherAction({ code, starts: startsISO }),
    );
    setVoucherLoading(false);
    if (!response.received) {
      reportTransportError(response.error, "booking.quoteVoucher.transport");
      setVoucherError(
        "Ověření voucheru se nepodařilo dokončit. Zkontrolujte připojení a zkuste to znovu.",
      );
      return;
    }
    const result = response.result;
    if (!result.ok) {
      setVoucherError(result.error);
      return;
    }
    setValue("voucherCode", result.data.code, { shouldValidate: true });
    setVoucherQuote(result.data);
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    // The selection comes from the page, never from the form's first render:
    // "Odebrat" changes only the URL, and a kept form must not book slots the
    // visitor has just removed.
    const response = await receiveAction(() =>
      startCheckoutAction({ ...values, starts: startsISO }),
    );
    if (!response.received) {
      reportTransportError(response.error, "booking.startCheckout.transport");
      setCheckoutInterrupted(true);
      setServerError(
        "Nepodařilo se načíst výsledek rezervace. Vaše údaje zůstaly vyplněné. Zkontrolujte připojení a zkuste pokračovat znovu.",
      );
      // The server may already have created the hold. Refreshing here could
      // redirect away from the form before the visitor can resume checkout.
      return;
    }
    setCheckoutInterrupted(false);
    const result = response.result;
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
        {
          value: result.data.totalCents / 100,
          currency: "CZK",
          num_items: startsISO.length,
        },
        `order:${result.data.orderId}:checkout`,
      );
      setRedirecting(true);
      window.location.href = result.data.url;
      return;
    }
    router.push(
      `/rezervace/hotovo?order_id=${result.data.orderId}${result.data.token ? `&token=${result.data.token}` : ""}`,
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate>
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
      <div className="-mt-2 grid gap-2">
        {/*
         * Only a member has a profile to keep the number in, and keeping it is
         * their choice: the box starts unticked and the next booking prefills
         * whatever it saved.
         */}
        {canSavePhone ? (
          <div className="flex min-h-11 items-center gap-3 text-sm">
            <input
              id="savePhone"
              type="checkbox"
              // `accent-color` is the only thing a native checkbox honours
              // here; border and radius utilities would be inert.
              className="size-5 shrink-0 accent-[var(--color-primary)]"
              {...register("savePhone")}
            />
            <label htmlFor="savePhone">
              Uložit telefon do profilu a příště ho předvyplnit.
            </label>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Potvrzení a kód ke vstupu vám pošleme e-mailem. Zasílání přes WhatsApp
          si můžete zapnout ve svém profilu.
        </p>
      </div>

      {totalCents > 0 ? (
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
              disabled={voucherLoading || voucherUnavailable}
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
              Voucher uplatněn na celou objednávku. Sleva{" "}
              {formatMoney(voucherQuote.discountCents)}, k platbě{" "}
              {formatMoney(voucherQuote.finalPriceCents)}.
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
        disabled={
          !ready ||
          redirecting ||
          formState.isSubmitting ||
          blocked ||
          (!paymentsAvailable && totalCents > 0)
        }
        aria-describedby={blocked ? "submit-blocked" : undefined}
        className="mt-6 w-full sm:w-auto"
      >
        {redirecting
          ? "Přesměrováváme na platební bránu…"
          : formState.isSubmitting
            ? "Ukládám rezervaci…"
            : checkoutInterrupted
              ? "Zkusit pokračovat znovu"
              : effectivePriceCents === 0
                ? startsISO.length === 1
                  ? "Potvrdit vstup zdarma"
                  : "Potvrdit vstupy zdarma"
                : `Pokračovat k platbě ${formatMoney(effectivePriceCents)}`}{" "}
        <ArrowRight aria-hidden="true" />
      </Button>
      {blocked ? (
        <p
          id="submit-blocked"
          className="mt-3 text-sm font-bold text-destructive"
        >
          Nejprve odeberte termíny, které už nelze rezervovat.
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {effectivePriceCents === 0
          ? "Vstup zdarma je platný po potvrzení rezervace."
          : startsISO.length === 1
            ? "Rezervace je platná až po ověřené úhradě. Termín držíme pouze po dobu zpracování platby."
            : "Všechny termíny zaplatíte jednou platbou. Rezervace jsou platné až po ověřené úhradě a termíny držíme pouze po dobu zpracování platby."}
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
