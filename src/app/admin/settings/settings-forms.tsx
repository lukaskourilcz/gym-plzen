"use client";

import { useRef, useState } from "react";
import { useActionForm } from "@/components/admin/use-action-form";
import {
  CheckboxField,
  Field,
  FormFeedback,
  SubmitButton,
} from "@/components/admin/form-controls";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  billingProfileSchema,
  brandingSchema,
  sitePhotosSchema,
  smsTemplateSchema,
} from "@/lib/validations/settings";
import {
  MAX_VAT_RATE_PERCENT,
  type BillingProfile,
} from "@/lib/config/billing";
import {
  saveBillingProfileAction,
  saveBrandingAction,
  saveSitePhotosAction,
  saveSmsTemplateAction,
  uploadFileAction,
} from "./actions";

/** Logo + terms PDF URLs. Paste a URL or use the uploader below to get one. */
export function BrandingForm({
  logoUrl,
  termsUrl,
  heroImageUrl,
  heroImageAlt,
  sectionsImageUrl,
}: {
  logoUrl: string;
  termsUrl: string;
  heroImageUrl: string;
  heroImageAlt: string;
  sectionsImageUrl: string;
}) {
  const { form, submit, serverError, success } = useActionForm({
    schema: brandingSchema,
    action: saveBrandingAction,
    successMessage: "Branding uložen.",
    defaultValues: {
      logoUrl,
      termsUrl,
      heroImageUrl,
      heroImageAlt,
      sectionsImageUrl,
    },
  });
  const { register, formState, watch } = form;
  const currentLogo = watch("logoUrl");
  const currentHero = watch("heroImageUrl");

  return (
    <form onSubmit={submit} className="max-w-xl">
      <Field name="logoUrl" label="URL loga" error={formState.errors.logoUrl}>
        <Input
          id="logoUrl"
          placeholder="https://…/logo.png"
          {...register("logoUrl")}
        />
      </Field>
      {currentLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentLogo} alt="Náhled loga" className="mb-3 max-h-14" />
      ) : null}
      <Field
        name="termsUrl"
        label="URL obchodních podmínek (PDF)"
        error={formState.errors.termsUrl}
      >
        <Input
          id="termsUrl"
          placeholder="https://…/podminky.pdf"
          {...register("termsUrl")}
        />
      </Field>
      <Field
        name="heroImageUrl"
        label="URL hlavní fotografie"
        error={formState.errors.heroImageUrl}
      >
        <Input
          id="heroImageUrl"
          placeholder="https://…/navi-prostor.jpg"
          {...register("heroImageUrl")}
        />
      </Field>
      <Field
        name="heroImageAlt"
        label="Alternativní text fotografie"
        error={formState.errors.heroImageAlt}
      >
        <Input
          id="heroImageAlt"
          placeholder="Popište skutečný obsah fotografie"
          {...register("heroImageAlt")}
        />
      </Field>
      {currentHero ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentHero}
          alt={watch("heroImageAlt") || "Náhled hlavní fotografie"}
          className="mb-4 aspect-[4/3] w-full rounded-md object-cover"
        />
      ) : null}
      <Field
        name="sectionsImageUrl"
        label="URL fotografie za sekcemi (Jak to funguje + Ceník)"
        error={formState.errors.sectionsImageUrl}
      >
        <Input
          id="sectionsImageUrl"
          placeholder="https://…/navi-telocvicna.jpg"
          {...register("sectionsImageUrl")}
        />
      </Field>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={formState.isSubmitting}>
        Uložit branding
      </SubmitButton>
    </form>
  );
}

/**
 * Gallery and zone photographs, plus the switch that labels them illustrative.
 * URLs come from the uploader below, exactly like the hero photograph.
 */
export function SitePhotosForm({
  gallery,
  zones,
  illustrative,
}: {
  gallery: string[];
  zones: string[];
  illustrative: boolean;
}) {
  const { form, submit, serverError, success } = useActionForm({
    schema: sitePhotosSchema,
    action: saveSitePhotosAction,
    successMessage: "Fotografie uloženy.",
    defaultValues: {
      gallery: [0, 1, 2, 3].map((index) => gallery[index] ?? ""),
      zones: [0, 1, 2, 3, 4, 5].map((index) => zones[index] ?? ""),
      illustrative,
    },
  });

  return (
    <form onSubmit={submit}>
      <p className="mb-4 text-sm text-muted-foreground">
        Nechte pole prázdné a na webu zůstane značková výplň. URL získáte
        nahráním souboru níže.
      </p>

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-extrabold">
          Galerie na úvodní stránce
        </legend>
        {[0, 1, 2, 3].map((index) => (
          <Field
            key={index}
            name={`gallery.${index}`}
            label={index === 0 ? "Hlavní fotografie" : `Dlaždice ${index + 1}`}
            error={form.formState.errors.gallery?.[index]}
          >
            <Input
              id={`gallery-${index}`}
              type="url"
              {...form.register(`gallery.${index}` as const)}
            />
          </Field>
        ))}
      </fieldset>

      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-extrabold">
          Fotografie zón na stránce Vybavení
        </legend>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Field
            key={index}
            name={`zones.${index}`}
            label={`Zóna ${index + 1}`}
            error={form.formState.errors.zones?.[index]}
          >
            <Input
              id={`zone-${index}`}
              type="url"
              {...form.register(`zones.${index}` as const)}
            />
          </Field>
        ))}
      </fieldset>

      <CheckboxField
        name="illustrative"
        label="Označit fotografie jako ilustrační"
        register={form.register("illustrative")}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Dokud nejsou fotky z vašeho prostoru, web u nich zobrazí informační
        ikonu s textem „Ilustrační foto“. Po nahrání vlastních snímků přepínač
        vypněte.
      </p>

      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>
        Uložit fotografie
      </SubmitButton>
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
      <Field
        name="template"
        label="Text SMS s kódem"
        error={form.formState.errors.template}
      >
        <Textarea id="template" rows={2} {...form.register("template")} />
      </Field>
      <p className="mb-2 text-xs text-muted-foreground">
        Zástupné symboly: <code>{"{code}"}</code> = kód, <code>{"{time}"}</code>{" "}
        = čas rezervace. WhatsApp používá šablonu schválenou v Meta (název{" "}
        <code>navi_rezervace_vstup_cs</code>).
      </p>
      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>
        Uložit šablonu
      </SubmitButton>
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
        <Label htmlFor="file">
          Soubor (logo, PDF podmínek, obrázek galerie)
        </Label>
        <Input
          id="file"
          type="file"
          ref={ref}
          accept="image/png,image/jpeg,image/webp,application/pdf"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Nahrávám…" : "Nahrát soubor"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
      {url && (
        <p className="mt-2 break-all text-sm font-medium text-accent-foreground">
          Nahráno. URL:{" "}
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {url}
          </a>
          <br />
          Zkopírujte URL do pole výše (logo / podmínky).
        </p>
      )}
    </form>
  );
}

/**
 * The operator's billing details and the switch that starts sending payment
 * documents. `missing` is what the profile still lacks : shown here rather
 * than only failing silently at payment time, because the operator needs to
 * know before a customer does that no document went out.
 */
export function BillingProfileForm({
  profile,
  sendDocuments,
  missing,
}: {
  profile: BillingProfile;
  sendDocuments: boolean;
  missing: string[];
}) {
  const { form, submit, serverError, success } = useActionForm({
    schema: billingProfileSchema,
    action: saveBillingProfileAction,
    successMessage: "Fakturační údaje uloženy.",
    defaultValues: { ...profile, sendDocuments },
  });

  return (
    <form onSubmit={submit} className="max-w-2xl">
      <p className="mb-5 rounded-md border border-border bg-muted p-4 text-sm leading-6">
        {missing.length > 0 ? (
          <>
            Doklady se zatím nevystavují. Chybí:{" "}
            <strong>{missing.join(", ")}</strong>. Systém údaje nikdy nedoplní
            za vás: doklad s vymyšleným IČO by byl horší než žádný.
          </>
        ) : (
          <>
            Předvyplněno podle článku 1.2 vašich obchodních podmínek, kde je
            jako osoba vystavující účetní a daňové doklady uvedena{" "}
            <strong>Renáta Janoušková</strong>. Zkontrolujte údaje a případně
            upravte: co uložíte tady, má přednost.
          </>
        )}
      </p>

      <Field
        name="legalName"
        label="Název firmy"
        error={form.formState.errors.legalName}
      >
        <Input id="legalName" {...form.register("legalName")} />
      </Field>
      <Field
        name="street"
        label="Ulice a číslo"
        error={form.formState.errors.street}
      >
        <Input id="street" {...form.register("street")} />
      </Field>
      <div className="grid gap-x-5 sm:grid-cols-[1fr_2fr]">
        <Field name="zip" label="PSČ" error={form.formState.errors.zip}>
          <Input id="zip" {...form.register("zip")} />
        </Field>
        <Field name="city" label="Město" error={form.formState.errors.city}>
          <Input id="city" {...form.register("city")} />
        </Field>
      </div>
      <div className="grid gap-x-5 sm:grid-cols-2">
        <Field name="ico" label="IČO" error={form.formState.errors.ico}>
          <Input id="ico" inputMode="numeric" {...form.register("ico")} />
        </Field>
        <Field
          name="dic"
          label="DIČ (jen plátce DPH)"
          error={form.formState.errors.dic}
        >
          <Input id="dic" {...form.register("dic")} />
        </Field>
      </div>
      <Field
        name="vatRatePercent"
        label="Sazba DPH v %"
        error={form.formState.errors.vatRatePercent}
      >
        <Input
          id="vatRatePercent"
          type="number"
          min={0}
          max={MAX_VAT_RATE_PERCENT}
          step={1}
          className="max-w-32"
          {...form.register("vatRatePercent", { valueAsNumber: true })}
        />
      </Field>
      <p className="mb-4 text-sm text-muted-foreground">
        Nechte <strong>0</strong>, pokud nejste plátcem DPH: doklad pak uvede
        jednu částku a větu „Neplátce DPH“ a žádné rozpady daně si nevymýšlí.
      </p>
      <Field
        name="bankAccount"
        label="Číslo účtu (nepovinné)"
        error={form.formState.errors.bankAccount}
      >
        <Input id="bankAccount" {...form.register("bankAccount")} />
      </Field>
      <Field
        name="registryNote"
        label="Zápis v rejstříku (nepovinné)"
        error={form.formState.errors.registryNote}
      >
        <Textarea
          id="registryNote"
          rows={2}
          {...form.register("registryNote")}
        />
      </Field>

      <CheckboxField
        name="sendDocuments"
        label="Po zaplacení automaticky poslat doklad e-mailem"
        register={form.register("sendDocuments")}
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Doklad se vystaví jednou pro každou zaplacenou rezervaci a odejde v
        příloze potvrzovacího e-mailu. Věrnostní vstup zdarma doklad nedostane :
        nulový doklad není doklad o platbě.
      </p>

      <FormFeedback error={serverError} success={success} />
      <SubmitButton isSubmitting={form.formState.isSubmitting}>
        Uložit fakturační údaje
      </SubmitButton>
    </form>
  );
}
