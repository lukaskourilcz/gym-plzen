"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { phoneSchema } from "@/lib/validations/common";
import { useActionForm } from "@/components/admin/use-action-form";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { completePhoneAction } from "./actions";

export function PhoneForm({ next }: { next: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);
  const { form, submit, serverError } = useActionForm({
    schema: z.object({ phone: phoneSchema }),
    action: completePhoneAction,
    defaultValues: { phone: "" },
    onSuccess: () => {
      router.replace(next);
      router.refresh();
    },
  });
  return (
    <form onSubmit={submit} className="mt-6">
      <Field name="phone" label="Telefon" error={form.formState.errors.phone}>
        <Input
          id="phone"
          type="tel"
          autoComplete="tel"
          required
          placeholder="+420 777 123 456"
          {...form.register("phone")}
        />
      </Field>
      <FormFeedback error={serverError} />
      <SubmitButton
        disabled={!ready}
        isSubmitting={form.formState.isSubmitting}
        pendingLabel="Ukládám…"
      >
        Uložit a pokračovat
      </SubmitButton>
    </form>
  );
}
