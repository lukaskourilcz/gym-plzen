"use client";

import {
  CheckboxRow,
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { useActionForm } from "@/components/admin/use-action-form";
import { Input } from "@/components/ui/input";
import {
  MAX_OPERATOR_RECIPIENTS,
  OPERATOR_EVENT_DEFINITIONS,
  operatorNotificationsSchema,
  type OperatorNotifications,
} from "@/lib/config/operator-notifications";
import { saveOperatorNotificationsAction } from "./actions";

/**
 * Which events reach the people who run the gym, and at which addresses.
 * Every row explains itself, because "Nová rezervace" alone does not say
 * whether an unpaid attempt counts.
 */
export function OperatorNotificationsForm({
  values,
}: {
  values: OperatorNotifications;
}) {
  const {
    form: { register, formState },
    submit,
    serverError,
    success,
  } = useActionForm({
    schema: operatorNotificationsSchema,
    action: saveOperatorNotificationsAction,
    defaultValues: values,
    successMessage: "Provozní upozornění byla uložena.",
  });

  return (
    <form onSubmit={submit} noValidate>
      <Field
        name="recipients"
        label="Adresy pro upozornění"
        error={formState.errors.recipients}
      >
        <Input
          id="recipients"
          type="text"
          inputMode="email"
          autoComplete="off"
          placeholder="vas@email.cz, druhy@email.cz"
          // Both ids: `Field` only adds its own when the control has none, and
          // the error must stay audible where the help text already speaks.
          aria-describedby="recipients-help recipients-error"
          {...register("recipients")}
        />
      </Field>
      <p id="recipients-help" className="mb-6 text-sm text-muted-foreground">
        Více adres oddělte čárkou, nejvýše {MAX_OPERATOR_RECIPIENTS}. Prázdné
        pole odesílání vypne.
      </p>

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-extrabold">
          Události, o kterých chcete vědět
        </legend>
        {OPERATOR_EVENT_DEFINITIONS.map((event) => (
          <CheckboxRow
            key={event.id}
            id={`event-${event.id}`}
            label={event.label}
            help={event.description}
            register={register(`events.${event.id}`)}
          />
        ))}
      </fieldset>

      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>
        Uložit provozní upozornění
      </SubmitButton>
    </form>
  );
}
