import { siteUrl } from "@/lib/helpers/site-url";

/**
 * The customer-facing transactional e-mails. Their subject and text body live
 * in `site_setting`, so an administrator can edit wording without a deployment.
 * Authentication templates are additionally synchronised to Supabase Auth.
 */

export const EMAIL_TEMPLATE_IDS = [
  "signup_confirmation",
  "password_reset",
  "reservation_confirmation",
  "access_code",
  "reservation_cancellation",
  "payment_document",
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
  delivery: "application" | "supabase_auth";
  actionLabel?: string;
  fallback: EmailTemplate;
}

export const EMAIL_TEMPLATE_DEFINITIONS: readonly EmailTemplateDefinition[] = [
  {
    id: "signup_confirmation",
    label: "Potvrzení registrace",
    description:
      "Odešle se po vytvoření účtu. Tlačítko pro potvrzení přidává systém automaticky.",
    variables: ["{name}"],
    delivery: "supabase_auth",
    actionLabel: "Potvrdit e-mail",
    fallback: {
      subject: "Potvrďte svůj e-mail | NAVI Private Gym",
      body: "Dobrý den, {name},\n\nvítáme vás v NAVI Private Gym. Pro dokončení registrace potvrďte svou e-mailovou adresu tlačítkem níže.\n\nPokud jste si účet nevytvořili, tento e-mail ignorujte.",
    },
  },
  {
    id: "password_reset",
    label: "Obnova hesla",
    description:
      "Odešle se po žádosti o změnu hesla. Tlačítko pro nastavení nového hesla přidává systém automaticky.",
    variables: ["{name}"],
    delivery: "supabase_auth",
    actionLabel: "Nastavit nové heslo",
    fallback: {
      subject: "Obnova hesla | NAVI Private Gym",
      body: "Dobrý den, {name},\n\nobdrželi jsme žádost o změnu hesla k vašemu účtu. Nové heslo nastavíte tlačítkem níže.\n\nPokud jste o změnu nežádali, tento e-mail můžete ignorovat.",
    },
  },
  {
    id: "reservation_confirmation",
    label: "Potvrzení rezervace",
    description:
      "Odešle se po úspěšné platbě nebo při bezplatném věrnostním vstupu.",
    variables: ["{name}", "{time}", "{duration}", "{price}", "{loyalty}"],
    delivery: "application",
    fallback: {
      subject: "Potvrzení rezervace | NAVI Private Gym",
      body: "Ahoj {name},\n\nvaše rezervace je potvrzená.\n\nTermín: {time}\nDélka: {duration}\nCena: {price}\n\n{loyalty}\n\nPřed začátkem rezervace vám pošleme osobní vstupní kód.\n\nNAVI Private Gym",
    },
  },
  {
    id: "access_code",
    label: "Vstupní kód",
    description:
      "Odešle se po vytvoření jednorázového kódu pro vstup do studia.",
    variables: ["{name}", "{code}", "{time}"],
    delivery: "application",
    fallback: {
      subject: "Váš vstupní kód | NAVI Private Gym",
      body: "Ahoj {name},\n\nvaše rezervace je dnes {time}.\n\nVstupní kód: {code}\n\nKód zadejte na klávesnici u dveří v čase vaší rezervace. Kód je osobní a platí pouze pro tento termín.\n\nNAVI Private Gym",
    },
  },
  {
    id: "payment_document",
    label: "Doklad o zaplacení",
    description:
      "Odešle se po zaplacení, s dokladem v příloze. Odesílání se zapíná v Nastavení → Fakturační údaje a vyžaduje vyplněné údaje firmy.",
    variables: ["{name}", "{number}", "{amount}", "{date}"],
    delivery: "application",
    fallback: {
      subject: "Doklad o zaplacení {number} | NAVI Private Gym",
      body: "Dobrý den, {name},\n\nv příloze posíláme doklad o zaplacení č. {number} ze dne {date} na částku {amount}.\n\nDoklad je uhrazený, neplaťte ho prosím znovu. Uschovejte si ho pro svou evidenci.\n\nNAVI Private Gym",
    },
  },
  {
    id: "reservation_cancellation",
    label: "Zrušení rezervace",
    description:
      "Odešle se při zrušení termínu administrací nebo při uzavření studia.",
    variables: ["{name}", "{time}", "{reason}"],
    delivery: "application",
    fallback: {
      subject: "Zrušení rezervace | NAVI Private Gym",
      body: "Ahoj {name},\n\nvaše rezervace na {time} byla bohužel zrušena.\n\nDůvod: {reason}\n\nOmlouváme se za komplikace. Vyberte si prosím jiný volný termín.\n\nNAVI Private Gym",
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

export function isSupabaseAuthEmailTemplate(id: EmailTemplateId): boolean {
  return getEmailTemplateDefinition(id).delivery === "supabase_auth";
}

/**
 * Collapse the gap a variable leaves behind when it resolves to nothing.
 * `{loyalty}` is empty for guests, and without this their confirmation would
 * carry a stray blank block where a member reads a sentence. Runs of two or
 * more newlines become exactly one paragraph break; single newlines, which
 * separate the reservation detail lines, are untouched.
 */
function collapseBlankParagraphs(value: string): string {
  return value.replace(/[^\S\n]*\n(?:[^\S\n]*\n)+/g, "\n\n").trim();
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
  return {
    subject: replace(template.subject).trim(),
    body: collapseBlankParagraphs(replace(template.body)),
  };
}

function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function emailTextToHtml(
  text: string,
  options?: { actionUrl?: string; actionLabel?: string },
): string {
  const paragraphs = escapeEmailHtml(text)
    .split(/\n{2,}/)
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px">${paragraph.replaceAll("\n", "<br />")}</p>`,
    )
    .join("");
  const action =
    options?.actionUrl && options.actionLabel
      ? `<p style="margin:26px 0 4px"><a href="${escapeEmailHtml(options.actionUrl)}" style="display:inline-block;background:#005340;color:#ffffff;padding:13px 20px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;font-weight:700">${escapeEmailHtml(options.actionLabel)}</a></p>`
      : "";

  return `<div style="margin:0;background:#f5f3ee;padding:32px 16px;color:#18221e;font-family:Georgia,'Times New Roman',serif;line-height:1.6"><div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d8d2c6;padding:36px"><img src="${siteUrl("/images/navi-logo-email.png")}" alt="NAVI Private Gym" width="150" style="display:block;width:150px;height:auto;margin:0 0 28px" /><p style="margin:0 0 24px;color:#005340;font-weight:700;letter-spacing:.08em;font-size:13px">NAVI PRIVATE GYM</p>${paragraphs}${action}<p style="margin:28px 0 0;color:#68706b;font-size:13px">Tento e-mail byl odeslán automaticky. Na tuto adresu prosím neodpovídejte.</p></div></div>`;
}
