"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { createReservationSchema } from "@/lib/validations/reservations";
import { createReservationAction } from "./actions";

/**
 * Admin manual-booking form (React Hook Form + Zod). Client validation uses the
 * same schema the server action re-validates with.
 */
export function ReservationForm() {
  const { form, submit, serverError, success } = useActionForm({
    schema: createReservationSchema,
    action: createReservationAction,
    successMessage: "Rezervace vytvořena.",
    resetOnSuccess: true,
  });
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;

  return (
    <form onSubmit={submit}>
      <Field name="startsAt" label="Začátek" error={errors.startsAt}>
        <Input
          id="startsAt"
          type="datetime-local"
          aria-describedby={
            errors.startsAt ? "startsAt-error startsAt-help" : "startsAt-help"
          }
          {...register("startsAt")}
        />
      </Field>
      <p
        id="startsAt-help"
        className="-mt-2 mb-4 text-sm text-muted-foreground"
      >
        Zadejte začátek okna podle otevírací doby. Konec se dopočítá z nastavené
        délky okna.
      </p>
      <Field
        name="contactName"
        label="Jméno zákazníka"
        error={errors.contactName}
      >
        <Input id="contactName" {...register("contactName")} />
      </Field>
      <Field name="contactEmail" label="E-mail" error={errors.contactEmail}>
        <Input id="contactEmail" type="email" {...register("contactEmail")} />
      </Field>
      <Field name="contactPhone" label="Telefon" error={errors.contactPhone}>
        <Input
          id="contactPhone"
          placeholder="+420…"
          {...register("contactPhone")}
        />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={isSubmitting}>
        Vytvořit rezervaci
      </SubmitButton>
    </form>
  );
}
