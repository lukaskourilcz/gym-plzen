"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { siteUrl } from "@/lib/helpers/site-url";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  describeSupabaseAuthFailure,
  emailTextToHtml,
  getEmailTemplateDefinition,
  renderEmailTemplateText,
  type EmailTemplate,
  type EmailTemplateId,
  type SupabaseAuthSyncStatus,
  type SupabaseAuthTemplateId,
} from "@/lib/config/email-templates";
import {
  emailTemplateSchema,
  emailTemplateTestSchema,
  type EmailTemplateTestValues,
  type EmailTemplateValues,
} from "@/lib/validations/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormFeedback } from "@/components/admin/form-controls";
import {
  saveEmailTemplateAction,
  sendEmailTemplateTestAction,
} from "../emails/actions";

const PREVIEW_VALUES: Record<string, string> = {
  name: "Klára",
  code: "482 916",
  time: "pondělí 3. srpna 2026 v 18:00",
  duration: "75 minut",
  price: "229 Kč",
  reason: "Úprava provozní doby",
  loyalty: "Tohle byla vaše 7. návštěva, do vstupu zdarma zbývají 3 vstupy.",
};

/** One line under a hosted template: is it live in Supabase Auth, and if not, why. */
function supabaseAuthTemplateStatus(
  id: EmailTemplateId,
  status: SupabaseAuthSyncStatus,
): string {
  if (!status.configured)
    return "Pro automatické propsání do Supabase Auth je potřeba doplnit serverovou proměnnou SUPABASE_MANAGEMENT_API_TOKEN ve Vercelu a spustit nový deployment.";
  if (!status.ok)
    return `Propojení se Supabase Auth selhalo${describeSupabaseAuthFailure(status)}. Zkontrolujte token ve Vercelu.`;
  return status.synced[id as SupabaseAuthTemplateId]
    ? "Tato šablona je v Supabase Auth propsaná. Po uložení se propíše znovu."
    : "Tato šablona v Supabase Auth ještě není propsaná. Uložte ji a propíše se automaticky.";
}

/** Edit, preview, and test every transactional template sent by this app. */
export function EmailTemplateForms({
  templates,
  supabaseAuthSync,
}: {
  templates: Record<EmailTemplateId, EmailTemplate>;
  supabaseAuthSync: SupabaseAuthSyncStatus;
}) {
  const [selectedId, setSelectedId] = useState<EmailTemplateId>(
    "reservation_confirmation",
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  const form = useForm<EmailTemplateValues>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: { id: selectedId, ...templates[selectedId] },
  });
  const testForm = useForm<EmailTemplateTestValues>({
    resolver: zodResolver(emailTemplateTestSchema),
    defaultValues: { id: selectedId, email: "" },
  });

  // Load the selected template, and reload it after a save: the saved copy
  // may differ from what was typed (the subject suffix is added on save).
  useEffect(() => {
    form.reset({ id: selectedId, ...templates[selectedId] });
    testForm.setValue("id", selectedId);
  }, [form, selectedId, templates, testForm]);

  // Feedback belongs to the template it was shown for; it stays until the
  // next action or a switch, not until the page re-renders behind it.
  useEffect(() => {
    setSaveError(null);
    setSaveSuccess(null);
    setTestError(null);
    setTestSuccess(null);
  }, [selectedId]);

  const watchedSubject = form.watch("subject");
  const watchedBody = form.watch("body");
  const preview = useMemo(
    () =>
      renderEmailTemplateText(
        { subject: watchedSubject ?? "", body: watchedBody ?? "" },
        PREVIEW_VALUES,
      ),
    [watchedBody, watchedSubject],
  );
  const definition = getEmailTemplateDefinition(selectedId);

  const save = form.handleSubmit(async (values) => {
    setSaveError(null);
    setSaveSuccess(null);
    const result = await saveEmailTemplateAction(values);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    const sync = result.data.supabaseSync;
    if (sync && !sync.synced) {
      setSaveError(
        sync.reason === "not_configured"
          ? "Text je uložený, ale do Supabase Auth se nepropsal: ve Vercelu chybí SUPABASE_MANAGEMENT_API_TOKEN, nebo běží deployment z doby před jeho přidáním."
          : `Text je uložený, ale propsání do Supabase Auth selhalo${describeSupabaseAuthFailure(sync)}. Zkontrolujte token ve Vercelu a uložte šablonu znovu.`,
      );
      return;
    }
    setSaveSuccess(
      sync
        ? "Šablona uložená a propsaná do Supabase Auth. Další odpovídající e-mail použije nový text."
        : "Šablona uložená. Další odpovídající e-mail použije nový text.",
    );
  });

  const sendTest = testForm.handleSubmit(async (values) => {
    setTestError(null);
    setTestSuccess(null);
    const result = await sendEmailTemplateTestAction({
      ...values,
      id: selectedId,
    });
    if (!result.ok) {
      setTestError(result.error);
      return;
    }
    setTestSuccess("Testovací e-mail byl předán Resend k doručení.");
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
      <div>
        <div
          className="mb-5 flex flex-wrap gap-2"
          role="tablist"
          aria-label="E-mailové šablony"
        >
          {EMAIL_TEMPLATE_DEFINITIONS.map((template) => (
            <Button
              key={template.id}
              type="button"
              variant={selectedId === template.id ? "default" : "outline"}
              className="min-h-11"
              role="tab"
              aria-selected={selectedId === template.id}
              onClick={() => setSelectedId(template.id)}
            >
              {template.label}
            </Button>
          ))}
        </div>

        <p className="mb-5 max-w-2xl text-sm leading-6 text-muted-foreground">
          {definition.description} Proměnné:{" "}
          {definition.variables.map((variable, index) => (
            <span key={variable}>
              <code className="font-semibold text-foreground">{variable}</code>
              {index < definition.variables.length - 1 ? ", " : "."}
            </span>
          ))}
          {definition.delivery === "supabase_auth" ? (
            <span className="block mt-2">
              {supabaseAuthTemplateStatus(selectedId, supabaseAuthSync)}
            </span>
          ) : null}
        </p>

        <form onSubmit={save} className="max-w-2xl">
          <input type="hidden" {...form.register("id")} />
          <div className="mb-4">
            <Label htmlFor="emailTemplateSubject">Předmět</Label>
            <Input
              id="emailTemplateSubject"
              {...form.register("subject")}
              aria-invalid={Boolean(form.formState.errors.subject)}
            />
            {form.formState.errors.subject?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.subject.message}
              </p>
            ) : null}
          </div>
          <div className="mb-4">
            <Label htmlFor="emailTemplateBody">Text e-mailu</Label>
            <Textarea
              id="emailTemplateBody"
              rows={14}
              {...form.register("body")}
              aria-invalid={Boolean(form.formState.errors.body)}
            />
            {form.formState.errors.body?.message ? (
              <p className="mt-1 text-xs text-destructive">
                {form.formState.errors.body.message}
              </p>
            ) : null}
          </div>
          <FormFeedback error={saveError} success={saveSuccess} />
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="mt-3 min-h-11"
          >
            {form.formState.isSubmitting ? "Ukládám…" : "Uložit šablonu"}
          </Button>
        </form>
      </div>

      <div className="border-t border-border pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
        <h4 className="text-base font-bold">Náhled</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Ukázková data: Klára, pondělí 3. srpna v 18:00 a kód 482 916.
        </p>
        <div className="mt-4 overflow-hidden border border-border bg-secondary/35 p-3">
          <p className="mb-3 break-words text-sm font-bold">
            {preview.subject}
          </p>
          <div
            className="bg-card shadow-sm"
            dangerouslySetInnerHTML={{
              __html: emailTextToHtml(
                preview.body,
                definition.delivery === "supabase_auth"
                  ? {
                      actionUrl:
                        selectedId === "signup_confirmation"
                          ? siteUrl("/login")
                          : siteUrl("/reset-password"),
                      actionLabel: definition.actionLabel,
                    }
                  : undefined,
              ),
            }}
          />
        </div>

        <form onSubmit={sendTest} className="mt-6">
          <input type="hidden" {...testForm.register("id")} />
          <Label htmlFor="emailTemplateTestRecipient">Odeslat test na</Label>
          <Input
            id="emailTemplateTestRecipient"
            type="email"
            autoComplete="email"
            placeholder="vas@email.cz"
            className="mt-1"
            {...testForm.register("email")}
            aria-invalid={Boolean(testForm.formState.errors.email)}
          />
          {testForm.formState.errors.email?.message ? (
            <p className="mt-1 text-xs text-destructive">
              {testForm.formState.errors.email.message}
            </p>
          ) : null}
          <FormFeedback error={testError} success={testSuccess} />
          <Button
            type="submit"
            variant="outline"
            disabled={testForm.formState.isSubmitting}
            className="mt-3 min-h-11"
          >
            {testForm.formState.isSubmitting
              ? "Odesílám…"
              : "Odeslat testovací e-mail"}
          </Button>
        </form>
      </div>
    </div>
  );
}
