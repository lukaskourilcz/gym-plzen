"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import { Field, FormFeedback, SubmitButton } from "@/components/admin/form-controls";
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
        <input id="phone" placeholder="+420…" {...register("phone")} />
      </Field>
      <label style={checkboxRow}>
        <input type="checkbox" style={{ width: "auto" }} {...register("notifyByWhatsapp")} />
        Posílat kódy přes WhatsApp
      </label>
      <label style={checkboxRow}>
        <input type="checkbox" style={{ width: "auto" }} {...register("notifyBySms")} />
        Posílat kódy přes SMS
      </label>
      <label style={checkboxRow}>
        <input type="checkbox" style={{ width: "auto" }} {...register("marketingConsent")} />
        Souhlas s marketingem
      </label>
      <Field name="note" label="Interní poznámka" error={formState.errors.note}>
        <textarea id="note" rows={2} {...register("note")} />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit</SubmitButton>
    </form>
  );
}

const checkboxRow: React.CSSProperties = {
  display: "flex",
  gap: "0.3rem",
  alignItems: "center",
  marginBottom: "0.6rem",
};
