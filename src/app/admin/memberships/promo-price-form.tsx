"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { promoPriceSchema } from "@/lib/validations/memberships";
import { setPromoPriceAction } from "./actions";

/**
 * Time-limited promotional price.
 *
 * The window is matched against the moment a customer books, not the slot they
 * book, so a reservation made during the promotion keeps the promotional price
 * even for a slot months later. Clearing all three fields ends the promotion.
 */
export function PromoPriceForm({
  currentPriceCzk,
  currentStartsAt,
  currentEndsAt,
  isRunning,
}: {
  currentPriceCzk?: number;
  /** `datetime-local` values, already expressed in the gym's timezone. */
  currentStartsAt?: string;
  currentEndsAt?: string;
  isRunning: boolean;
}) {
  const { form, submit, serverError, success } = useActionForm({
    schema: promoPriceSchema,
    action: setPromoPriceAction,
    successMessage: "Akční cena uložena.",
    defaultValues: {
      priceCzk: currentPriceCzk,
      startsAt: currentStartsAt ?? "",
      endsAt: currentEndsAt ?? "",
    },
  });
  const { register, formState } = form;

  return (
    <form onSubmit={submit} className="max-w-md">
      {isRunning && (
        <p className="mb-4">
          <Badge variant="accent">Akce právě platí</Badge>
        </p>
      )}
      <p className="mb-4 text-sm text-muted-foreground">
        Akční cena se použije podle toho,{" "}
        <strong>kdy zákazník rezervuje</strong>, ne na kdy si termín rezervuje.
        Kdo rezervuje během akce, zaplatí akční cenu i za termín v dalších
        měsících. Každý 10. vstup zůstává zdarma (platí pro zákazníky s účtem).
        Vymazáním všech tří polí akci ukončíte.
      </p>

      <Field
        name="priceCzk"
        label="Akční cena vstupu (Kč)"
        error={formState.errors.priceCzk}
      >
        <Input
          id="priceCzk"
          type="number"
          min={1}
          step={1}
          {...register("priceCzk", {
            setValueAs: (value) =>
              value === "" || value === null ? undefined : Number(value),
          })}
        />
      </Field>

      <Field
        name="startsAt"
        label="Akce začíná"
        error={formState.errors.startsAt}
      >
        <Input id="startsAt" type="datetime-local" {...register("startsAt")} />
      </Field>

      <Field name="endsAt" label="Akce končí" error={formState.errors.endsAt}>
        <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
      </Field>

      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>
        Uložit akci
      </SubmitButton>
    </form>
  );
}
