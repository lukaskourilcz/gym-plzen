"use client";

import { useRef, useState } from "react";
import { useActionForm } from "@/components/admin/use-action-form";
import { Field, FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { brandingSchema, heroPreviewSchema, smsTemplateSchema } from "@/lib/validations/settings";
import { MAX_HERO_PREVIEW_DAYS, MIN_HERO_PREVIEW_DAYS } from "@/lib/config/hero";
import { saveBrandingAction, saveHeroPreviewAction, saveSmsTemplateAction, uploadFileAction } from "./actions";

/** Logo + terms PDF URLs. Paste a URL or use the uploader below to get one. */
export function BrandingForm({ logoUrl, termsUrl }: { logoUrl: string; termsUrl: string }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: brandingSchema,
    action: saveBrandingAction,
    successMessage: "Branding uložen.",
    defaultValues: { logoUrl, termsUrl },
  });
  const { register, formState, watch } = form;
  const currentLogo = watch("logoUrl");

  return (
    <form onSubmit={submit} className="max-w-xl">
      <Field name="logoUrl" label="URL loga" error={formState.errors.logoUrl}>
        <Input id="logoUrl" placeholder="https://…/logo.png" {...register("logoUrl")} />
      </Field>
      {currentLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentLogo} alt="Náhled loga" className="mb-3 max-h-14" />
      ) : null}
      <Field name="termsUrl" label="URL obchodních podmínek (PDF)" error={formState.errors.termsUrl}>
        <Input id="termsUrl" placeholder="https://…/podminky.pdf" {...register("termsUrl")} />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit branding</SubmitButton>
    </form>
  );
}

/** Hero calendar: how many days ahead visitors can browse with the arrow. */
export function HeroCalendarForm({ previewDays }: { previewDays: number }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: heroPreviewSchema,
    action: saveHeroPreviewAction,
    successMessage: "Nastavení kalendáře uloženo.",
    defaultValues: { previewDays },
  });
  const { register, formState } = form;

  return (
    <form onSubmit={submit} className="max-w-xs">
      <Field
        name="previewDays"
        label="Počet dní dopředu (včetně dneška)"
        error={formState.errors.previewDays}
      >
        <Input
          id="previewDays"
          type="number"
          min={MIN_HERO_PREVIEW_DAYS}
          max={MAX_HERO_PREVIEW_DAYS}
          step={1}
          {...register("previewDays", { valueAsNumber: true })}
        />
      </Field>
      <p className="mb-2 text-xs text-muted-foreground">
        Kolik dní může návštěvník na hlavní stránce prolistovat šipkou v kalendáři volných termínů
        ({MIN_HERO_PREVIEW_DAYS}–{MAX_HERO_PREVIEW_DAYS}).
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit kalendář</SubmitButton>
    </form>
  );
}

/** SMS access-code template editor. */
export function SmsTemplateForm({ template }: { template: string }) {
  const { form, submit, serverError, success } = useActionForm({
    schema: smsTemplateSchema,
    action: saveSmsTemplateAction,
    successMessage: "Šablona uložena.",
    defaultValues: { template },
  });
  return (
    <form onSubmit={submit} className="max-w-xl">
      <Field name="template" label="Text SMS s kódem" error={form.formState.errors.template}>
        <Textarea id="template" rows={2} {...form.register("template")} />
      </Field>
      <p className="mb-2 text-xs text-muted-foreground">
        Zástupné symboly: <code>{"{code}"}</code> = kód, <code>{"{time}"}</code> = čas rezervace.
        WhatsApp používá šablonu schválenou v Meta (název <code>access_code</code>).
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>Uložit šablonu</SubmitButton>
    </form>
  );
}

/** Generic file uploader → returns a public URL to paste into the branding form. */
export function FileUploader() {
  const ref = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = ref.current?.files?.[0];
    if (!file) {
      setError("Vyberte soubor.");
      return;
    }
    setError(null);
    setUrl(null);
    setPending(true);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadFileAction(fd);
    setPending(false);
    if (result.ok) setUrl(result.data.url);
    else setError(result.error);
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl">
      <div className="mb-4">
        <Label htmlFor="file">Soubor (logo, PDF podmínek, obrázek galerie)</Label>
        <Input id="file" type="file" ref={ref} accept="image/*,application/pdf" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Nahrávám…" : "Nahrát soubor"}
      </Button>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      {url && (
        <p className="mt-2 break-all text-sm font-medium text-primary">
          Nahráno. URL:{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
            {url}
          </a>
          <br />
          Zkopírujte URL do pole výše (logo / podmínky).
        </p>
      )}
    </form>
  );
}
