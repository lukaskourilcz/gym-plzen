"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import { FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { setMemberRoleSchema } from "@/lib/validations/members";
import { setMemberRoleAction } from "./actions";

/**
 * Grant or revoke the administrator role for one member.
 *
 * Revoking is destructive access-wise, so it asks first and the service
 * refuses to remove the last administrator. Granting needs no confirmation.
 */
export function MemberRoleForm({
  userId,
  isAdmin,
  name,
}: {
  userId: string;
  isAdmin: boolean;
  name: string;
}) {
  const nextRole = isAdmin ? "member" : "admin";
  const { form, submit, serverError, success } = useActionForm({
    schema: setMemberRoleSchema,
    action: setMemberRoleAction,
    successMessage: isAdmin
      ? "Práva správce odebrána."
      : "Člen je nyní správce.",
    defaultValues: { userId, role: nextRole },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (
          isAdmin &&
          !window.confirm(`Opravdu odebrat práva správce pro ${name}?`)
        ) {
          return;
        }
        void submit(event);
      }}
      className="mt-4 border-t border-border pt-4"
    >
      <input type="hidden" {...form.register("userId")} />
      <input type="hidden" {...form.register("role")} />
      <p className="mb-3 text-sm text-muted-foreground">
        {isAdmin
          ? "Tento člen má přístup do celé administrace."
          : "Správce může upravovat obsah webu, ceny, rezervace a e-maily."}
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton
        isSubmitting={form.formState.isSubmitting}
        variant={isAdmin ? "outline" : "default"}
      >
        {isAdmin ? "Odebrat správce" : "Nastavit jako správce"}
      </SubmitButton>
    </form>
  );
}
