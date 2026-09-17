"use client";

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
}: {
  period?: {
    id: string;
    name: string;
    priceCzk: number;
    startsOn: string;
    endsOn: string;
  };
}) {
  const { form, submit, serverError, success } = useActionForm({
    schema: pricingPeriodSchema,
    action: savePricingPeriodAction,
    successMessage: period
      ? "Cenové období upraveno."
      : "Cenové období přidáno.",
    resetOnSuccess: !period,
    defaultValues: period ?? {
      name: "",
      priceCzk: undefined,
      startsOn: "",
      endsOn: "",
    },
  });
  const { register, formState } = form;

  return (
    <form onSubmit={submit} className="max-w-xl" id="price-period-form">
      {period ? <input type="hidden" {...register("id")} /> : null}
      <Field
        name="name"
        controlId="period-name"
        label="Název období"
        error={formState.errors.name}
      >
        <Input
          id="period-name"
          placeholder="Např. Říjnová akce"
          autoComplete="off"
          {...register("name")}
        />
      </Field>

      <Field
        name="priceCzk"
        controlId="period-priceCzk"
        label="Cena rezervace (Kč)"
        error={formState.errors.priceCzk}
      >
        <Input
          id="period-priceCzk"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          {...register("priceCzk", { valueAsNumber: true })}
        />
      </Field>

      <div className="grid gap-x-4 sm:grid-cols-2">
        <Field
          name="startsOn"
          controlId="period-startsOn"
          label="Platí od (včetně)"
          error={formState.errors.startsOn}
        >
          <Input id="period-startsOn" type="date" {...register("startsOn")} />
        </Field>
        <Field
          name="endsOn"
          controlId="period-endsOn"
          label="Platí do (včetně)"
          error={formState.errors.endsOn}
        >
          <Input id="period-endsOn" type="date" {...register("endsOn")} />
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
        {period ? (
          <Button href="/admin/memberships#price-periods" variant="outline">
            Zrušit úpravy
          </Button>
        ) : null}
      </div>
    </form>
  );
}
