"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import {
  passwordResetRequestSchema,
  type PasswordResetRequestValues,
} from "@/lib/validations/auth";
import { requestPasswordResetAction } from "@/app/login/actions";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { register, handleSubmit, formState } =
    useForm<PasswordResetRequestValues>({
      resolver: zodResolver(passwordResetRequestSchema),
      defaultValues: { email: "" },
    });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    const result = await requestPasswordResetAction(values);
    if (!result.ok) {
      setServerError(result.error ?? "Obnovu hesla teď nelze odeslat.");
      return;
    }
    setSuccess("Pokud účet existuje, odeslali jsme odkaz pro obnovu hesla.");
  });

  return (
    <form onSubmit={submit}>
      <Field name="email" label="E-mail" error={formState.errors.email}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="vas@email.cz"
          {...register("email")}
        />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton
        isSubmitting={formState.isSubmitting}
        className="mt-3 h-[50px] w-full"
      >
        Poslat odkaz pro obnovu
      </SubmitButton>
    </form>
  );
}
