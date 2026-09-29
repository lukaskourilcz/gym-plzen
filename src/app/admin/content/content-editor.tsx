"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import {
  CONTENT_EDITOR_SECTIONS,
  type ContentEditorItem,
} from "@/lib/content/editor";
import {
  editPublicTextSchema,
  type EditPublicTextValues,
} from "@/lib/validations/cms";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { savePublicTextAction } from "./actions";

function ContentRow({
  item,
  value,
  onEdit,
}: {
  item: ContentEditorItem;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-[minmax(10rem,.35fr)_1fr_auto] sm:items-start sm:gap-5">
      <p className="text-sm font-extrabold">{item.label}</p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
        {value}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Upravit: ${item.label}`}
        onClick={onEdit}
      >
        <Pencil aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Plain-language CMS: current copy first, one focused edit action at a time. */
export function ContentEditor({ values }: { values: Record<string, string> }) {
  const [editing, setEditing] = useState<ContentEditorItem | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } =
    useForm<EditPublicTextValues>({
      resolver: zodResolver(editPublicTextSchema),
      defaultValues: { key: "", valueText: "" },
    });

  function startEditing(item: ContentEditorItem) {
    reset({ key: item.key, valueText: values[item.key] ?? "" });
    setEditing(item);
    setSaved(null);
    setServerError(null);
  }

  const submit = handleSubmit(async (input) => {
    setSaved(null);
    setServerError(null);
    const result = await savePublicTextAction(input);
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    setSaved("Text je uložený a projeví se na webu.");
  });

  return (
    <div className="grid gap-6">
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Vyberte ikonu úprav u textu, který chcete změnit. Technické nastavení
        obsahu je skryté, aby se nemohlo omylem poškodit zobrazení webu.
      </p>

      {CONTENT_EDITOR_SECTIONS.map((section) => (
        <section
          key={section.title}
          className="overflow-hidden border border-border bg-card"
        >
          <div className="border-b border-border bg-secondary/40 px-4 py-4 sm:px-5">
            <h2 className="font-extrabold">{section.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {section.description}
            </p>
          </div>
          <div>
            {section.items.map((item) => (
              <ContentRow
                key={item.key}
                item={item}
                value={values[item.key] ?? ""}
                onEdit={() => startEditing(item)}
              />
            ))}
          </div>
        </section>
      ))}

      {editing ? (
        <div className="sticky bottom-4 z-10 border border-border bg-card p-5 shadow-md">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold">Upravit: {editing.label}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upravujete pouze text, který se zobrazí návštěvníkům.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(null)}
            >
              Zavřít
            </Button>
          </div>
          <form onSubmit={submit}>
            <input type="hidden" {...register("key")} />
            <Textarea
              rows={7}
              aria-label={`Text: ${editing.label}`}
              aria-invalid={!!formState.errors.valueText}
              aria-describedby={
                formState.errors.valueText ? "content-value-error" : undefined
              }
              {...register("valueText")}
            />
            {formState.errors.valueText?.message ? (
              <p
                id="content-value-error"
                className="mt-1 text-xs text-destructive"
              >
                {formState.errors.valueText.message}
              </p>
            ) : null}
            <FormFeedback error={serverError} success={saved} />
            <div className="mt-3 flex flex-wrap gap-3">
              <SubmitButton isSubmitting={formState.isSubmitting}>
                Uložit změny
              </SubmitButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                Zrušit
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
