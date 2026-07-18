"use client";

import { useRef, useState } from "react";
import { useActionForm } from "@/components/admin/use-action-form";
import { Field, FormFeedback, SubmitButton } from "@/components/admin/form-controls";
import { brandingSchema, smsTemplateSchema } from "@/lib/validations/settings";
import { saveBrandingAction, saveSmsTemplateAction, uploadFileAction } from "./actions";

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
    <form onSubmit={submit} style={{ maxWidth: 520 }}>
      <Field name="logoUrl" label="URL loga" error={formState.errors.logoUrl}>
        <input id="logoUrl" placeholder="https://…/logo.png" {...register("logoUrl")} />
      </Field>
      {currentLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentLogo} alt="Náhled loga" style={{ maxHeight: 56, marginBottom: "0.75rem" }} />
      ) : null}
      <Field name="termsUrl" label="URL obchodních podmínek (PDF)" error={formState.errors.termsUrl}>
        <input id="termsUrl" placeholder="https://…/podminky.pdf" {...register("termsUrl")} />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>Uložit branding</SubmitButton>
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
    <form onSubmit={submit} style={{ maxWidth: 520 }}>
      <Field name="template" label="Text SMS s kódem" error={form.formState.errors.template}>
        <textarea id="template" rows={2} {...form.register("template")} />
      </Field>
      <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
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
    <form onSubmit={onSubmit} style={{ maxWidth: 520 }}>
      <div className="field">
        <label htmlFor="file">Soubor (logo, PDF podmínek, obrázek galerie)</label>
        <input id="file" type="file" ref={ref} accept="image/*,application/pdf" />
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "Nahrávám…" : "Nahrát soubor"}
      </button>
      {error && <p className="field-error">{error}</p>}
      {url && (
        <p className="form-ok" style={{ marginTop: "0.5rem", wordBreak: "break-all" }}>
          Nahráno. URL: <a href={url} target="_blank" rel="noopener noreferrer">{url}</a>
          <br />
          Zkopírujte URL do pole výše (logo / podmínky).
        </p>
      )}
    </form>
  );
}
