"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminDialog } from "@/components/admin/dialog";
import {
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { useActionForm } from "@/components/admin/use-action-form";
import {
  updateMemberContactSchema,
  type UpdateMemberContactValues,
} from "@/lib/validations/members";
import type { Profile } from "@/lib/db/types";
import { updateMemberContactAction } from "./actions";

export function MemberContactEditor({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        <Pencil className="size-4" aria-hidden="true" />
        Upravit údaje
      </Button>
      {saved ? (
        <p role="status" className="text-sm text-success">
          Údaje zákazníka uloženy.
        </p>
      ) : null}
      {open ? (
        <ContactForm
          profile={profile}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            setSaved(true);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function ContactForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile: Profile;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const defaults: UpdateMemberContactValues = {
    userId: profile.id,
    fullName: profile.fullName ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    expected: {
      fullName: profile.fullName,
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phone,
    },
  };
  const { form, submit, serverError, success } = useActionForm({
    schema: updateMemberContactSchema,
    action: updateMemberContactAction,
    defaultValues: defaults,
    onSuccess: onSaved,
  });
  const { register, formState } = form;
  return (
    <AdminDialog
      title="Upravit údaje zákazníka"
      description="E-mail slouží také k přihlášení a pro nové rezervace. Kontaktní údaje již vytvořených rezervací se touto úpravou nemění."
      onClose={onCancel}
      busy={formState.isSubmitting}
    >
      <form onSubmit={submit} noValidate>
        <Field
          name="fullName"
          label="Jméno a příjmení"
          error={formState.errors.fullName}
        >
          <Input
            id="fullName"
            autoComplete="name"
            maxLength={120}
            data-initial-focus="true"
            {...register("fullName")}
          />
        </Field>
        <Field name="email" label="E-mail" error={formState.errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            {...register("email")}
          />
        </Field>
        <Field name="phone" label="Telefon" error={formState.errors.phone}>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+420 777 123 456"
            {...register("phone")}
          />
        </Field>
        <FormFeedback error={serverError} success={success} />
        <div className="mt-4 flex flex-wrap gap-2">
          <SubmitButton isSubmitting={formState.isSubmitting}>
            Uložit údaje
          </SubmitButton>
          <Button
            type="button"
            variant="ghost"
            disabled={formState.isSubmitting}
            onClick={onCancel}
          >
            Zrušit
          </Button>
        </div>
      </form>
    </AdminDialog>
  );
}
