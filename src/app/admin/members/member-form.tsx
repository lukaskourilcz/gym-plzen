"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import {
  CheckboxField,
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateMemberSchema } from "@/lib/validations/members";
import type { MemberWithProfile } from "@/lib/services/members";
import { updateMemberAction } from "./actions";

/** Edit one member's profile fields (React Hook Form + Zod). */
export function MemberForm({ member }: { member: MemberWithProfile }) {
  const p = member.profile;
  const { form, submit, serverError, success } = useActionForm({
    schema: updateMemberSchema,
    action: updateMemberAction,
    defaultValues: {
      userId: member.user.id,
      phone: p?.phone ?? "",
      notifyByWhatsapp: p?.notifyByWhatsapp ?? true,
      notifyBySms: p?.notifyBySms ?? false,
      marketingConsent: p?.marketingConsent ?? false,
      note: p?.note ?? "",
    },
  });
  const { register, formState } = form;

  return (
    <form onSubmit={submit}>
      <input type="hidden" {...register("userId")} />
      <Field name="phone" label="Telefon (E.164)" error={formState.errors.phone}>
        <Input id="phone" placeholder="+420…" {...register("phone")} />
      </Field>
      <CheckboxField name="notifyByWhatsapp" label="Posílat kódy přes WhatsApp" register={register("notifyByWhatsapp")} />
      <CheckboxField name="notifyBySms" label="Posílat kódy přes SMS" register={register("notifyBySms")} />
      <CheckboxField name="marketingConsent" label="Souhlas s marketingem" register={register("marketingConsent")} />
      <Field name="note" label="Interní poznámka" error={formState.errors.note}>
        <Textarea id="note" rows={2} {...register("note")} />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit</SubmitButton>
    </form>
  );
}
