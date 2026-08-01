/**
 * The customer-facing transactional e-mails that the application owns. Their
 * subject and text body live in `site_setting`, so an administrator can edit
 * wording without a deployment. Supabase owns its authentication e-mail HTML
 * (registration / reset password) because it sends those messages over SMTP.
 */

export const EMAIL_TEMPLATE_IDS = [
  "reservation_confirmation",
  "access_code",
  "reservation_cancellation",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export interface EmailTemplate {
  subject: string;
  body: string;
}

export interface EmailTemplateDefinition {
  id: EmailTemplateId;
  label: string;
  description: string;
  variables: readonly string[];
  fallback: EmailTemplate;
}

export const EMAIL_TEMPLATE_DEFINITIONS: readonly EmailTemplateDefinition[] = [
  {
    id: "reservation_confirmation",
    label: "Potvrzení rezervace",
    description:
      "Odešle se po úspěšné platbě nebo při bezplatném věrnostním vstupu.",
    variables: ["{name}", "{time}", "{duration}", "{price}"],
    fallback: {
      subject: "Potvrzení rezervace | NAMASTÉ Private Gym",
      body: "Ahoj {name},\n\nvaše rezervace je potvrzená.\n\nTermín: {time}\nDélka: {duration}\nCena: {price}\n\nPřed začátkem rezervace vám pošleme osobní vstupní kód.\n\nNAMASTÉ Private Gym",
    },
  },
  {
    id: "access_code",
    label: "Vstupní kód",
    description:
      "Odešle se po vytvoření jednorázového kódu pro vstup do studia.",
    variables: ["{name}", "{code}", "{time}"],
    fallback: {
      subject: "Váš vstupní kód | NAMASTÉ Private Gym",
      body: "Ahoj {name},\n\nvaše rezervace je dnes {time}.\n\nVstupní kód: {code}\n\nKód zadejte na klávesnici u dveří v čase vaší rezervace. Kód je osobní a platí pouze pro tento termín.\n\nNAMASTÉ Private Gym",
    },
  },
  {
    id: "reservation_cancellation",
    label: "Zrušení rezervace",
    description:
      "Odešle se při zrušení termínu administrací nebo při uzavření studia.",
    variables: ["{name}", "{time}", "{reason}"],
    fallback: {
      subject: "Zrušení rezervace | NAMASTÉ Private Gym",
      body: "Ahoj {name},\n\nvaše rezervace na {time} byla bohužel zrušena.\n\nDůvod: {reason}\n\nOmlouváme se za komplikace. Vyberte si prosím jiný volný termín.\n\nNAMASTÉ Private Gym",
    },
  },
];

export function isEmailTemplateId(value: string): value is EmailTemplateId {
  return (EMAIL_TEMPLATE_IDS as readonly string[]).includes(value);
}

export function emailTemplateSettingKey(id: EmailTemplateId): string {
  return `messages.email.${id}`;
}

export function getEmailTemplateDefinition(
  id: EmailTemplateId,
): EmailTemplateDefinition {
  const definition = EMAIL_TEMPLATE_DEFINITIONS.find(
    (template) => template.id === id,
  );
  if (!definition) throw new Error(`Unknown e-mail template: ${id}`);
  return definition;
}

/** Plain text only: template authoring never injects arbitrary HTML into mail. */
export function renderEmailTemplateText(
  template: EmailTemplate,
  variables: Record<string, string>,
): EmailTemplate {
  const replace = (value: string) =>
    value.replace(/\{([a-z_]+)\}/g, (token, key: string) =>
      Object.hasOwn(variables, key) ? variables[key]! : token,
    );
  return { subject: replace(template.subject), body: replace(template.body) };
}

export function emailTextToHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px">${paragraph.replaceAll("\n", "<br />")}</p>`,
    )
    .join("");

  return `<div style="margin:0;background:#f5f3ee;padding:32px 16px;color:#18221e;font-family:Georgia,'Times New Roman',serif;line-height:1.6"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d8d2c6;padding:36px"><p style="margin:0 0 28px;color:#005340;font-weight:700;letter-spacing:.08em;font-size:13px">NAMASTÉ PRIVATE GYM</p>${paragraphs}<p style="margin:28px 0 0;color:#68706b;font-size:13px">Tento e-mail byl odeslán automaticky. Na tuto adresu prosím neodpovídejte.</p></div></div>`;
}
