"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDialog } from "./dialog";
import { useActionForm } from "./use-action-form";
import { Field, FormFeedback, SubmitButton } from "./form-controls";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateMemberNoteSchema } from "@/lib/validations/members";
import { updateMemberNoteAction } from "@/app/admin/members/actions";

export function MemberNoteEditor({
  userId,
  name,
  note,
}: {
  userId: string;
  name: string;
  note?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => {
          setSaved(false);
          setOpen(true);
        }}
      >
        {note?.trim() ? "Upravit poznámku" : "Přidat poznámku"}
      </Button>
      {saved ? (
        <p role="status" className="mt-1 text-xs text-success">
          Poznámka uložena.
        </p>
      ) : null}
      {open ? (
        <AdminDialog
          title={note?.trim() ? "Upravit poznámku" : "Přidat poznámku"}
          description={`${name} · Interní poznámka viditelná v administraci. Smazáním textu poznámku odstraníte.`}
          onClose={() => setOpen(false)}
        >
          <NoteForm
            userId={userId}
            note={note ?? ""}
            onCancel={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              setSaved(true);
              router.refresh();
            }}
          />
        </AdminDialog>
      ) : null}
    </>
  );
}
function NoteForm({
  userId,
  note,
  onSaved,
  onCancel,
}: {
  userId: string;
  note: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const inputId = useId();
  const { form, submit, serverError } = useActionForm({
    schema: updateMemberNoteSchema,
    action: updateMemberNoteAction,
    defaultValues: { userId, note },
    onSuccess: onSaved,
  });
  return (
    <form onSubmit={submit} noValidate>
      <Field
        name="note"
        controlId={inputId}
        label="Poznámka"
        error={form.formState.errors.note}
      >
        <Textarea
          id={inputId}
          rows={5}
          maxLength={2000}
          data-initial-focus="true"
          {...form.register("note")}
        />
      </Field>
      <FormFeedback error={serverError} />
      <div className="mt-4 flex gap-2">
        <SubmitButton isSubmitting={form.formState.isSubmitting}>
          Uložit poznámku
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Zrušit
        </Button>
      </div>
    </form>
  );
}
