"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import {
  MAX_BOOKING_HORIZON_DAYS,
  MIN_BOOKING_HORIZON_DAYS,
} from "@/lib/config/schedule";
import { bookingHorizonSchema } from "@/lib/validations/settings";
import { saveBookingHorizonAction } from "./actions";

export function BookingHorizonForm({ horizonDays }: { horizonDays: number }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: bookingHorizonSchema,
    action: saveBookingHorizonAction,
    successMessage: "Rozsah rezervací uložen.",
    defaultValues: { horizonDays },
  });

  return (
    <form onSubmit={submit} className="max-w-xs">
      <Field
        name="horizonDays"
        label="Kolik dní dopředu lze rezervovat"
        error={form.formState.errors.horizonDays}
      >
        <Input
          id="horizonDays"
          type="number"
          min={MIN_BOOKING_HORIZON_DAYS}
          max={MAX_BOOKING_HORIZON_DAYS}
          step={1}
          inputMode="numeric"
          {...form.register("horizonDays", { valueAsNumber: true })}
        />
      </Field>
      <p className="mb-4 text-sm text-muted-foreground">
        Cena období se řídí datem návštěvy. Tento limit určuje, jak vzdálený
        termín si zákazník může vybrat.
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>
        Uložit rozsah
      </SubmitButton>
    </form>
  );
}
