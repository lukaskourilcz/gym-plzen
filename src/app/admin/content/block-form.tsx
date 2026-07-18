"use client";

import { useActionForm } from "@/components/admin/use-action-form";
import { Field, FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { upsertBlockSchema } from "@/lib/validations/cms";
import type { ContentBlock } from "@/lib/db/types";
import { saveBlockAction } from "./actions";

/**
 * Create/edit a single content block (React Hook Form + Zod). When `block` is
 * provided the form is pre-filled and `key` is read-only so the block's
 * identity stays stable.
 */
export function BlockForm({ block }: { block?: ContentBlock }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: upsertBlockSchema,
    action: saveBlockAction,
    successMessage: "Obsah uložen.",
    defaultValues: {
      key: block?.key ?? "",
      locale: block?.locale ?? "cs",
      type: block?.type ?? "text",
      valueText: block?.valueText ?? "",
      label: block?.label ?? "",
      groupName: block?.groupName ?? "",
      sortOrder: block?.sortOrder ?? 0,
    },
  });
  const { register, formState } = form;
  const { errors, isSubmitting } = formState;

  return (
    <form onSubmit={submit}>
      <Field name="key" label="Klíč (např. home.hero.title)" error={errors.key}>
        <Input id="key" readOnly={Boolean(block)} {...register("key")} />
      </Field>
      <Field name="label" label="Popisek pro editor" error={errors.label}>
        <Input id="label" {...register("label")} />
      </Field>
      <Field name="groupName" label="Skupina (např. home)" error={errors.groupName}>
        <Input id="groupName" {...register("groupName")} />
      </Field>
      <Field name="type" label="Typ" error={errors.type}>
        <Select id="type" {...register("type")}>
          <option value="text">Text</option>
          <option value="richtext">Formátovaný text</option>
          <option value="json">JSON</option>
        </Select>
      </Field>
      <Field name="valueText" label="Hodnota" error={errors.valueText}>
        <Textarea id="valueText" rows={4} {...register("valueText")} />
      </Field>
      <input type="hidden" {...register("locale")} />
      <input type="hidden" {...register("sortOrder", { valueAsNumber: true })} />
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={isSubmitting}>
        {block ? "Uložit změny" : "Vytvořit blok"}
      </SubmitButton>
    </form>
  );
}
