"use client";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { useActionForm } from "@/components/admin/use-action-form";
import { Input } from "@/components/ui/input";
import { operationsSchema, type Operations } from "@/lib/config/operations";
import { saveOperationsAction } from "./actions";

export function OperationsForm({ values }: { values: Operations }) {
  const {
    form: { register, formState },
    submit,
    serverError,
    success,
  } = useActionForm({
    schema: operationsSchema,
    action: saveOperationsAction,
    defaultValues: values,
    successMessage: "Provozní nastavení bylo uloženo.",
  });
  return (
    <form onSubmit={submit} noValidate>
      <label className="mb-4 flex min-h-11 items-center gap-3 text-sm font-bold">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          {...register("paymentsEnabled")}
        />{" "}
        Aktivovat online platby přes Comgate
      </label>
      <p className="mb-4 text-sm text-muted-foreground">
        Rezervace platí až po ověřené úhradě. Bez aktivních plateb se lze
        registrovat a prohlížet termíny.
      </p>
      <Field
        name="bookingsFrom"
        label="První den dostupný pro rezervace"
        error={formState.errors.bookingsFrom}
      >
        <Input id="bookingsFrom" type="date" {...register("bookingsFrom")} />
      </Field>
      <p className="mb-4 text-sm text-muted-foreground">
        Datum omezuje kalendář i ukládání rezervací. Prázdné pole ponechá
        všechny budoucí termíny.
      </p>
      <label className="mb-4 flex min-h-11 items-center gap-3 text-sm font-bold">
        <input
          type="checkbox"
          className="size-5 accent-primary"
          {...register("accessCodesEnabled")}
        />
        Aktivovat vstupní kódy přes Nuki
      </label>
      <p className="mb-5 text-sm text-muted-foreground">
        Zapněte až po instalaci a fyzickém otestování zámku. Registrace,
        rezervace a platby fungují samostatně.
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>
        Uložit provozní nastavení
      </SubmitButton>
    </form>
  );
}
