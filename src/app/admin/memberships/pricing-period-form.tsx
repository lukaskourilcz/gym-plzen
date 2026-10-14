"use client";

import { useId } from "react";
import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pricingPeriodSchema } from "@/lib/validations/memberships";
import { savePricingPeriodAction } from "./actions";

/** Create or edit one reusable booking-time price period. */
export function PricingPeriodForm({
  period,
  onSaved,
  onCancel,
}: {
  onSaved?: () => void;
  onCancel?: () => void;
  period?: {
    id: string;
    name: string;
    priceCzk: number;
    startsOn: string;
    endsOn: string;
  };
}) {
  const inputId = useId();
  const { form, submit, serverError, success } = useActionForm({
    schema: pricingPeriodSchema,
    action: savePricingPeriodAction,
    successMessage: period
      ? "Cenové období upraveno."
      : "Cenové období přidáno.",
    resetOnSuccess: !period,
    onSuccess: onSaved,
    defaultValues: period ?? {
      name: "",
      priceCzk: undefined,
      startsOn: "",
      endsOn: "",
    },
  });
  const { register, formState } = form;

  return (
    <form
      onSubmit={submit}
      className="max-w-xl"
      id={period ? "price-period-form" : "price-period-add-form"}
    >
      {period ? <input type="hidden" {...register("id")} /> : null}
      <Field
        name={`${inputId}-name`}
        controlId={`${inputId}-name`}
        label="Název období"
        error={formState.errors.name}
      >
        <Input
          id={`${inputId}-name`}
          data-initial-focus="true"
          placeholder="Např. Říjnová akce"
          autoComplete="off"
          {...register("name")}
        />
      </Field>

      <Field
        name={`${inputId}-priceCzk`}
        controlId={`${inputId}-priceCzk`}
        label="Cena rezervace (Kč)"
        error={formState.errors.priceCzk}
      >
        <Input
          id={`${inputId}-priceCzk`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          {...register("priceCzk", { valueAsNumber: true })}
        />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field
          name={`${inputId}-startsOn`}
          controlId={`${inputId}-startsOn`}
          label="Platí od (včetně)"
          error={formState.errors.startsOn}
        >
          <Input
            id={`${inputId}-startsOn`}
            type="date"
            {...register("startsOn")}
          />
        </Field>
        <Field
          name={`${inputId}-endsOn`}
          controlId={`${inputId}-endsOn`}
          label="Platí do (včetně)"
          error={formState.errors.endsOn}
        >
          <Input id={`${inputId}-endsOn`} type="date" {...register("endsOn")} />
        </Field>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Cena nové rezervace se řídí datem návštěvy, ne datem nákupu. Říjnový
        termín tak stojí 199 Kč i při rezervaci před začátkem října.
      </p>
      <FormFeedback error={serverError} success={success} />
      <div className="mt-3 flex flex-wrap gap-2">
        <SubmitButton isSubmitting={formState.isSubmitting}>
          {period ? "Uložit změny" : "Přidat období"}
        </SubmitButton>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Zrušit
          </Button>
        ) : null}
        {period ? (
          <Button href="/admin/memberships#price-periods" variant="outline">
            Zrušit úpravy
          </Button>
        ) : null}
      </div>
    </form>
  );
}
