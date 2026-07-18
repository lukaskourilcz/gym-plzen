"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import { Field, FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { entryPriceSchema } from "@/lib/validations/memberships";
import { setEntryPriceAction } from "./actions";

/** Edit the single entry price (in Kč) — React Hook Form + Zod. */
export function EntryPriceForm({ currentCzk }: { currentCzk: number }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: entryPriceSchema,
    action: setEntryPriceAction,
    successMessage: "Cena vstupného uložena.",
    defaultValues: { priceCzk: currentCzk },
  });
  const { register, formState } = form;

  return (
    <form onSubmit={submit} style={{ maxWidth: 320 }}>
      <Field
        name="priceCzk"
        label="Cena jednorázového vstupu (Kč)"
        error={formState.errors.priceCzk}
      >
        <input
          id="priceCzk"
          type="number"
          min={0}
          step={1}
          {...register("priceCzk", { valueAsNumber: true })}
        />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit cenu</SubmitButton>
    </form>
  );
}
