"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createVoucherSchema } from "@/lib/validations/vouchers";
import { createVoucherAction } from "./actions";

export function VoucherForm() {
  const { form, submit, serverError, success } = useActionForm({
    schema: createVoucherSchema,
    action: createVoucherAction,
    resetOnSuccess: true,
    successMessage: "Voucher byl vytvořen.",
    defaultValues: {
      code: "",
      kind: "percentage",
      value: 10,
      validFrom: "",
      validUntil: "",
    },
  });
  const { register, watch, formState } = form;
  const kind = watch("kind");

  return (
    <form onSubmit={submit} noValidate>
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field name="code" label="Kód voucheru" error={formState.errors.code}>
          <Input
            id="code"
            autoComplete="off"
            placeholder="Prázdné = automaticky vygenerovat"
            {...register("code")}
          />
        </Field>
        <Field name="kind" label="Typ slevy" error={formState.errors.kind}>
          <Select id="kind" {...register("kind")}>
            <option value="percentage">Procentuální sleva</option>
            <option value="fixed_amount">Pevná sleva v Kč</option>
          </Select>
        </Field>
        <Field
          name="value"
          label={kind === "percentage" ? "Sleva (%)" : "Sleva (Kč)"}
          error={formState.errors.value}
        >
          <Input
            id="value"
            type="number"
            min={1}
            max={kind === "percentage" ? 100 : undefined}
            step={kind === "percentage" ? 1 : 0.01}
            {...register("value", { valueAsNumber: true })}
          />
        </Field>
        <Field
          name="maxRedemptions"
          label="Maximální počet použití"
          error={formState.errors.maxRedemptions}
        >
          <Input
            id="maxRedemptions"
            type="number"
            min={1}
            placeholder="Bez omezení"
            {...register("maxRedemptions", {
              setValueAs: (value) =>
                value === "" ? undefined : Number.parseInt(value, 10),
            })}
          />
        </Field>
        <Field
          name="validFrom"
          label="Platný od"
          error={formState.errors.validFrom}
        >
          <Input
            id="validFrom"
            type="datetime-local"
            {...register("validFrom")}
          />
        </Field>
        <Field
          name="validUntil"
          label="Platný do"
          error={formState.errors.validUntil}
        >
          <Input
            id="validUntil"
            type="datetime-local"
            {...register("validUntil")}
          />
        </Field>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Sleva, po které zbývá méně než minimální platba Stripe 15 Kč, dokončí
        rezervaci jako bezplatnou.
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>
        Vytvořit voucher
      </SubmitButton>
    </form>
  );
}
