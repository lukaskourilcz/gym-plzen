"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight } from "lucide-react";
import {
  CONTENT_EDITOR_SECTIONS,
  getContentEditorItem,
  type ContentEditorItem,
} from "@/lib/content/editor";
import {
  CONTENT_VISUALS,
  type ContentAsset,
} from "@/lib/content/editor-visuals";
import {
  editPublicTextSchema,
  type EditPublicTextValues,
} from "@/lib/validations/cms";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { AdminDialog } from "@/components/admin/dialog";
import { FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { receiveAction } from "@/lib/helpers/action-response";
import { savePublicTextAction } from "./actions";
import { AssetEditor } from "./asset-editor";
import { ContentCanvas } from "./content-canvas";
import type { ContentPreviewData } from "./canvas-controls";
import type { Announcement } from "@/lib/config/opening";
import { AnnouncementEditor } from "./announcement-editor";

/** Focus one website section at a time, with a visual reference and explicit data sources. */
export function ContentEditor({
  announcement,
  values,
  assets,
  preview,
}: {
  announcement: Announcement;
  values: Record<string, string>;
  assets: Record<string, string>;
  preview: ContentPreviewData;
}) {
  const params = useSearchParams();
  const active = params.get("section") ?? "hero";
  const section =
    CONTENT_EDITOR_SECTIONS.find(
      (s) => CONTENT_VISUALS[s.title]?.id === active,
    ) ?? CONTENT_EDITOR_SECTIONS[0]!;
  const visual = CONTENT_VISUALS[section.title]!;
  const [texts, setTexts] = useState(values);
  const [rendered, setRendered] = useState(preview.texts);
  const [editingAsset, setEditingAsset] = useState<ContentAsset | null>(null);
  const [images, setImages] = useState(assets);
  const [editing, setEditing] = useState<ContentEditorItem | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState } =
    useForm<EditPublicTextValues>({
      resolver: zodResolver(editPublicTextSchema),
      defaultValues: { key: "", valueText: "" },
    });
  function startEditing(item: ContentEditorItem) {
    reset({ key: item.key, valueText: texts[item.key] ?? "" });
    setEditing(item);
    setSaved(null);
    setServerError(null);
  }
  const submit = handleSubmit(async (input) => {
    setSaved(null);
    setServerError(null);
    const response = await receiveAction(() => savePublicTextAction(input));
    if (!response.received) {
      setServerError("Uložení se nepodařilo potvrdit. Zkuste to znovu.");
      return;
    }
    if (!response.result.ok) {
      setServerError(response.result.error);
      return;
    }
    setTexts((previous) => ({ ...previous, [input.key]: input.valueText }));
    setRendered(response.result.data.texts);
    setSaved("Text je uložený a projeví se na webu.");
  });
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[200px_minmax(0,1fr)]">
      <nav
        aria-label="Části webu"
        className="flex gap-2 overflow-x-auto pb-2 xl:sticky xl:top-6 xl:grid xl:overflow-visible"
      >
        {CONTENT_EDITOR_SECTIONS.map((s) => (
          <Link
            key={s.title}
            href={`/admin/content?section=${CONTENT_VISUALS[s.title]!.id}`}
            scroll={false}
            aria-current={s.title === section.title ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${s.title === section.title ? "border-primary/25 bg-primary/10 text-primary" : "border-transparent hover:bg-secondary"}`}
          >
            {s.title}
          </Link>
        ))}
      </nav>
      <section aria-labelledby="content-section-title" className="min-w-0">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="content-section-title"
              className="text-2xl font-bold tracking-tight"
            >
              {section.title}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {section.description}
            </p>
          </div>
          <Button
            href={visual.href}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            Otevřít na webu
            <ArrowUpRight aria-hidden="true" />
          </Button>
        </div>
        <p className="mb-4 text-sm leading-6 text-muted-foreground">
          Vyberte tužku přímo u textu nebo fotografie. Uložená změna se zveřejní
          na webu. Náhledové formuláře neslouží k rezervaci ani k odesílání.
        </p>
        {visual.id === "opening" ? (
          <AnnouncementEditor initialValue={announcement} />
        ) : (
          <ContentCanvas
            section={section}
            preview={{ ...preview, texts: rendered }}
            assets={images}
            onEdit={startEditing}
            onEditAsset={setEditingAsset}
          />
        )}
        {visual.dependencies.length ? (
          <details className="mt-5 rounded-lg border border-border bg-card p-4">
            <summary className="cursor-pointer font-semibold">
              Co se načítá odjinud
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {visual.dependencies.map((dependency) => (
                <div key={dependency.label}>
                  <p className="text-sm font-semibold">{dependency.label}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {dependency.description}
                  </p>
                  <Link
                    href={dependency.href}
                    className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary underline"
                  >
                    {dependency.linkLabel}
                    <ArrowUpRight aria-hidden="true" className="size-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </section>
      {editingAsset ? (
        <AdminDialog
          title={`Upravit: ${editingAsset.label}`}
          description="Sdílená fotografie se změní ve všech částech webu, které ji používají."
          onClose={() => setEditingAsset(null)}
        >
          <AssetEditor
            key={editingAsset.key}
            asset={editingAsset}
            value={images[editingAsset.key] ?? ""}
            saved={(value) =>
              setImages((previous) => ({
                ...previous,
                [editingAsset.key]: value,
              }))
            }
          />
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => setEditingAsset(null)}
          >
            Hotovo
          </Button>
        </AdminDialog>
      ) : null}
      {editing ? (
        <AdminDialog
          title={`Upravit: ${editing.label}`}
          description={`Část webu: ${getContentEditorItem(editing.key).section}`}
          onClose={() => setEditing(null)}
        >
          <form onSubmit={submit}>
            <input type="hidden" {...register("key")} />
            <Textarea
              data-initial-focus
              rows={7}
              aria-label={`Text: ${editing.label}`}
              aria-invalid={!!formState.errors.valueText}
              {...register("valueText")}
            />
            {formState.errors.valueText?.message ? (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {formState.errors.valueText.message}
              </p>
            ) : null}
            {(texts[editing.key] ?? "").includes("{") ? (
              <Notice className="mt-4">
                Zachovejte značky v závorkách, například {"{price}"} nebo{" "}
                {"{promoEndsAt}"}. Jejich hodnotu systém doplňuje z příslušného
                nastavení.
              </Notice>
            ) : null}
            <FormFeedback error={serverError} success={saved} />
            <div className="mt-4 flex flex-wrap gap-3">
              <SubmitButton isSubmitting={formState.isSubmitting}>
                Uložit změny
              </SubmitButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
              >
                {saved ? "Hotovo" : "Zrušit"}
              </Button>
            </div>
          </form>
        </AdminDialog>
      ) : null}
    </div>
  );
}
