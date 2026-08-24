"use client";

import Link from "next/link";
import { useActionForm } from "@/components/admin/use-action-form";
import { FormFeedback } from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { newsletterSignupSchema } from "@/lib/validations/newsletter";
import { subscribeNewsletterAction } from "@/app/newsletter/actions";

export function NewsletterSignup() {
  const { form, submit, serverError, success } = useActionForm({
    schema: newsletterSignupSchema,
    action: subscribeNewsletterAction,
    successMessage: "Děkujeme. E-mail jsme zařadili mezi odběratele.",
    resetOnSuccess: true,
    defaultValues: { email: "", website: "" },
  });
  const { register, formState } = form;
  const emailError = formState.errors.email?.message;

  return (
    <form onSubmit={submit} noValidate className="mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="newsletter-email" className="sr-only">
            E-mailová adresa
          </label>
          <Input
            id="newsletter-email"
            type="email"
            autoComplete="email"
            placeholder="vas@email.cz"
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? "newsletter-email-error" : undefined}
            className="border-white/35 bg-white text-foreground"
            {...register("email")}
          />
          {emailError ? (
            <p
              id="newsletter-email-error"
              className="mt-1 text-sm text-[#ffd4d0]"
            >
              {emailError}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          disabled={formState.isSubmitting}
          className="shrink-0 bg-gold text-gold-foreground hover:bg-gold/90"
        >
          {formState.isSubmitting ? "Ukládám…" : "Chci novinky"}
        </Button>
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="newsletter-website">Web</label>
        <input
          id="newsletter-website"
          tabIndex={-1}
          autoComplete="off"
          {...register("website")}
        />
      </div>
      <FormFeedback error={serverError} success={success} />
      <p className="mt-3 text-xs leading-5 text-ink-foreground/70">
        Odesláním souhlasíte se zpracováním e-mailu pro zasílání novinek.
        Souhlas můžete kdykoli odvolat. Podrobnosti najdete v{" "}
        <Link href="/ochrana-soukromi" className="underline hover:text-white">
          zásadách ochrany soukromí
        </Link>
        .
      </p>
    </form>
  );
}
