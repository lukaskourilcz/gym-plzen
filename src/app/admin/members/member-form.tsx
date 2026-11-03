"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import {
  CheckboxField,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
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
      notifyByWhatsapp: p?.notifyByWhatsapp ?? false,
      notifyBySms: p?.notifyBySms ?? false,
      marketingConsent: p?.marketingConsent ?? false,
    },
  });
  const { register, formState } = form;

  return (
    <form onSubmit={submit}>
      <input type="hidden" {...register("userId")} />
      <CheckboxField
        name="notifyByWhatsapp"
        label="Posílat kódy přes WhatsApp"
        register={register("notifyByWhatsapp")}
      />
      <CheckboxField
        name="notifyBySms"
        label="Posílat kódy přes SMS"
        register={register("notifyBySms")}
      />
      <CheckboxField
        name="marketingConsent"
        label="Souhlas s marketingem"
        register={register("marketingConsent")}
      />
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit</SubmitButton>
    </form>
  );
}
