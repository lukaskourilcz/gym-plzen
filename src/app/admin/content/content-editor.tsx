"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, ImagePlus, Pencil } from "lucide-react";
import {
  CONTENT_EDITOR_SECTIONS,
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
import { contentAssetSchema } from "@/lib/validations/content-asset";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AdminDialog } from "@/components/admin/dialog";
import { FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { receiveAction } from "@/lib/helpers/action-response";
import { savePublicTextAction, saveContentAssetAction } from "./actions";

function AssetEditor({
  asset,
  value,
  saved,
}: {
  asset: ContentAsset;
  value: string;
  saved: (value: string) => void;
}) {
  const [current, setCurrent] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="grid gap-3 rounded-md border border-border p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setSuccess(null);
        const input = contentAssetSchema.safeParse({
          key: asset.key,
          value: current,
        });
        if (!input.success) {
          setError(input.error.issues[0]?.message ?? "Zkontrolujte údaj.");
          return;
        }
        setBusy(true);
        const response = await receiveAction(() =>
          saveContentAssetAction(input.data),
        );
        setBusy(false);
        if (!response.received) {
          setError("Uložení se nepodařilo potvrdit. Zkuste to znovu.");
          return;
        }
        if (!response.result.ok) {
          setError(response.result.error);
          return;
        }
        saved(input.data.value);
        setSuccess("Změna je uložená a projeví se na webu.");
      }}
    >
      <label className="grid gap-2 text-sm font-bold">
        {asset.label}
        <Input
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          required
          maxLength={asset.kind === "text" ? 180 : 2048}
          placeholder={
            asset.kind === "image" ? "https://…/fotografie.webp" : undefined
          }
        />
      </label>
      {asset.kind === "image" ? (
        <div className="flex flex-wrap items-center gap-4">
          <Image
            src={value}
            alt={`Aktuální: ${asset.label}`}
            width={180}
            height={110}
            unoptimized
            className="h-24 w-40 rounded-md border border-border object-cover"
          />
          <Link
            href="/admin/settings#upload"
            className="text-sm font-semibold text-primary underline"
          >
            Nahrát novou fotografii a získat její adresu
          </Link>
        </div>
      ) : null}
      <FormFeedback error={error} success={success} />
      <SubmitButton isSubmitting={busy} className="justify-self-start">
        Uložit {asset.kind === "image" ? "fotografii" : "popis"}
      </SubmitButton>
    </form>
  );
}

/** Focus one website section at a time, with a visual reference and explicit data sources. */
export function ContentEditor({
  values,
  assets,
}: {
  values: Record<string, string>;
  assets: Record<string, string>;
}) {
  const params = useSearchParams();
  const active = params.get("section") ?? "hero";
  const section =
    CONTENT_EDITOR_SECTIONS.find(
      (s) => CONTENT_VISUALS[s.title]?.id === active,
    ) ?? CONTENT_EDITOR_SECTIONS[0]!;
  const visual = CONTENT_VISUALS[section.title]!;
  const [texts, setTexts] = useState(values);
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
        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="order-2 min-w-0 2xl:order-1">
            {visual.dependencies.length ? (
              <Card className="mb-5 p-4 sm:p-5">
                <h3 className="font-semibold">Co se načítá odjinud</h3>
                <div className="mt-4 grid gap-4">
                  {visual.dependencies.map((dependency) => (
                    <div key={dependency.label}>
                      <p className="text-sm font-semibold">
                        {dependency.label}
                      </p>
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
              </Card>
            ) : null}
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-4 sm:px-5">
                <h3 className="font-semibold">Texty této části</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Vyberte tužku u konkrétního textu. Ostatní obsah se nezmění.
                </p>
              </div>
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-4 last:border-0 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                      {texts[item.key]}
                    </p>
                    {/\{(?:price|pricePerPerson|promoEndsAt|companionPrice|duration)\}/.test(
                      texts[item.key] ?? "",
                    ) ? (
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Údaj v závorkách se doplní automaticky.{" "}
                        <Link
                          className="text-primary underline"
                          href={
                            item.key === "home.pricing.duration"
                              ? "/admin/schedule"
                              : "/admin/memberships"
                          }
                        >
                          {item.key === "home.pricing.duration"
                            ? "Upravit délku bloků v rozvrhu"
                            : "Upravit zdroj v Ceníku a doprovodu"}
                        </Link>
                        .
                      </p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Upravit: ${item.label}`}
                    onClick={() => startEditing(item)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </Card>
            {visual.assets.length ? (
              <Card className="mt-5 p-4 sm:p-5">
                <h3 className="flex items-center gap-2 font-semibold">
                  <ImagePlus aria-hidden="true" className="size-4" />
                  Fotografie této části
                </h3>
                <p className="mb-5 mt-2 text-sm text-muted-foreground">
                  Vložte adresu vlastní fotografie. Změna se projeví všude, kde
                  je stejný snímek použitý.
                </p>
                <div className="grid gap-4">
                  {visual.assets.map((asset) => (
                    <AssetEditor
                      key={asset.key}
                      asset={asset}
                      value={images[asset.key] ?? ""}
                      saved={(value) =>
                        setImages((previous) => ({
                          ...previous,
                          [asset.key]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </Card>
            ) : null}
          </div>
          <figure className="order-1 min-w-0 overflow-hidden rounded-lg border border-border bg-card 2xl:sticky 2xl:top-6 2xl:order-2">
            <a
              href={`/images/content-previews/${visual.id}.webp`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Image
                src={`/images/content-previews/${visual.id}.webp`}
                alt={`Snímek části webu: ${section.title}`}
                width={1200}
                height={800}
                unoptimized
                className="max-h-80 w-full object-cover object-top 2xl:max-h-none"
              />
            </a>
            <figcaption className="border-t border-border p-4 text-xs leading-5 text-muted-foreground">
              <strong className="block text-sm font-semibold text-foreground">
                Takto část vypadá na webu
              </strong>
              Orientační snímek rozvržení. Aktuální texty a fotografie jsou v
              editoru; publikovaný výsledek otevřete tlačítkem nahoře.
            </figcaption>
          </figure>
        </div>
      </section>
      {editing ? (
        <AdminDialog
          title={`Upravit: ${editing.label}`}
          description={`Část webu: ${section.title}`}
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
