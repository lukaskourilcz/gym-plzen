"use client";

import {
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
 * Every row is a 44px target with its own explanation, because "Nová
 * rezervace" alone does not say whether an unpaid attempt counts.
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
          placeholder="info@navigym.cz, druhy@navigym.cz"
          aria-describedby="recipients-help"
          {...register("recipients")}
        />
      </Field>
      <p id="recipients-help" className="mb-5 text-sm text-muted-foreground">
        Více adres oddělte čárkou, nejvýše {MAX_OPERATOR_RECIPIENTS}. Prázdné
        pole odesílání vypne. Zákazníkům tyto e-maily nechodí.
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 text-sm font-bold">
          O čem chcete vědět e-mailem
        </legend>
        {OPERATOR_EVENT_DEFINITIONS.map((event) => (
          <div key={event.id} className="mb-3 last:mb-0">
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
              <input
                id={`event-${event.id}`}
                type="checkbox"
                className="size-5 accent-primary"
                aria-describedby={`event-${event.id}-help`}
                {...register(`events.${event.id}`)}
              />
              {event.label}
            </label>
            <p
              id={`event-${event.id}-help`}
              className="text-sm text-muted-foreground"
            >
              {event.description}
            </p>
          </div>
        ))}
      </fieldset>

      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>
        Uložit provozní upozornění
      </SubmitButton>
    </form>
  );
}
