"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import {
  passwordUpdateSchema,
  type PasswordUpdateValues,
} from "@/lib/validations/auth";
import { updatePasswordAction } from "./actions";

export function ResetPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<PasswordUpdateValues>({
    resolver: zodResolver(passwordUpdateSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  });

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setSuccess(null);
    const result = await updatePasswordAction(values);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSuccess("Heslo bylo změněno. Přesměrovávám do účtu…");
    router.push("/account");
    router.refresh();
  });

  return (
    <form onSubmit={submit}>
      <Field
        name="password"
        label="Nové heslo"
        error={formState.errors.password}
      >
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register("password")}
        />
      </Field>
      <Field
        name="passwordConfirmation"
        label="Nové heslo znovu"
        error={formState.errors.passwordConfirmation}
      >
        <Input
          id="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          {...register("passwordConfirmation")}
        />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton
        isSubmitting={formState.isSubmitting}
        className="mt-3 h-[50px] w-full"
      >
        Uložit nové heslo
      </SubmitButton>
    </form>
  );
}
