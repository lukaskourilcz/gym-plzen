import { siteHost, siteUrl } from "@/lib/helpers/site-url";

/**
 * The customer-facing transactional e-mails. Their subject and text body live
 * in `site_setting`, so an administrator can edit wording without a deployment.
 * Authentication templates are additionally synchronised to Supabase Auth.
 */

export const EMAIL_TEMPLATE_IDS = [
  "signup_confirmation",
  "password_reset",
  "reservation_confirmation",
  "reservation_rescheduled",
  "access_code",
  "reservation_cancellation",
  "payment_document",
  "operator_notice",
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
    id: "reservation_rescheduled",
    label: "Změna termínu",
    description:
      "Odešle se po změně termínu z účtu zákazníka, s aktualizovanou pozvánkou do kalendáře v příloze.",
    variables: ["{name}", "{previous_time}", "{time}", "{duration}"],
    delivery: "application",
    fallback: {
      subject: "Změna termínu rezervace | NAVI Private Gym",
      body: "Ahoj {name},\n\nváš termín jsme změnili.\n\nPůvodní termín: {previous_time}\nNový termín: {time}\nDélka: {duration}\n\nPůvodní čas je uvolněný a v příloze je aktualizovaná pozvánka do kalendáře. Před začátkem rezervace vám pošleme osobní vstupní kód.\n\nNAVI Private Gym",
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
  {
    id: "operator_notice",
    label: "Upozornění pro provozovatele",
    description:
      "Interní e-mail pro provozovatele, ne pro zákazníka. Které události chodí a na jaké adresy, se nastavuje v Nastavení a branding → Provozní upozornění.",
    variables: ["{event}", "{summary}", "{detail}"],
    delivery: "application",
    actionLabel: "Otevřít administraci",
    fallback: {
      subject: "{event} | NAVI Private Gym",
      body: "{summary}\n\n{detail}\n\nToto je interní upozornění z rezervačního systému. Které události chodí a komu, nastavíte v administraci v sekci Nastavení a branding, Provozní upozornění.",
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

/** The display name every e-mail is sent under, whatever the provider holds. */
export const EMAIL_BRAND = "NAVI Private Gym";
const SUBJECT_SUFFIX = ` | ${EMAIL_BRAND}`;
const SUBJECT_SUFFIX_PATTERN = /\s*\|?\s*NAVI Private Gym\s*$/i;

/** Every subject ends with " | NAVI Private Gym", exactly once. */
export function brandedSubject(subject: string): string {
  const base = subject.replace(SUBJECT_SUFFIX_PATTERN, "").trim();
  return base ? `${base}${SUBJECT_SUFFIX}` : EMAIL_BRAND;
}

/**
 * "NAVI Private Gym <address>" from a configured sender that may carry any
 * display name, or none: the brand is not something an environment variable
 * gets to decide.
 */
export function brandedSender(configured: string): string {
  const match = configured.match(/<([^<>\s]+@[^<>\s]+)>/);
  const address = (match?.[1] ?? configured).trim();
  return `${EMAIL_BRAND} <${address}>`;
}

/** The two templates Supabase Auth delivers; the rest go through Resend. */
export const SUPABASE_AUTH_TEMPLATE_IDS = [
  "signup_confirmation",
  "password_reset",
] as const satisfies readonly EmailTemplateId[];
export type SupabaseAuthTemplateId =
  (typeof SUPABASE_AUTH_TEMPLATE_IDS)[number];

/** What saving one hosted template did on Supabase's side. */
export type SupabaseAuthSyncResult =
  | { synced: true }
  | { synced: false; reason: "not_configured" }
  | {
      synced: false;
      reason: "request_failed";
      status?: number;
      detail?: string;
    };

/**
 * Whether the hosted auth config can be read with the configured token, and
 * which templates already carry our confirmation link.
 */
export type SupabaseAuthSyncStatus =
  | { configured: false }
  | { configured: true; ok: false; status?: number; detail?: string }
  | {
      configured: true;
      ok: true;
      synced: Record<SupabaseAuthTemplateId, boolean>;
      /** The SMTP sender name Supabase Auth currently sends under. */
      senderName: string | null;
    };

/** " (HTTP 401: Unauthorized)" for a failure, or "" when nothing is known. */
export function describeSupabaseAuthFailure(failure: {
  status?: number;
  detail?: string;
}): string {
  const parts = [
    failure.status ? `HTTP ${failure.status}` : null,
    failure.detail || null,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? ` (${parts.join(": ")})` : "";
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

/**
 * The palette, restated as literal hex, because an e-mail client cannot read
 * a CSS variable. This is the only place the design tokens are duplicated:
 * every value mirrors its token in `globals.css` (`page` is `background`,
 * `surface` is `card`, `detail` is `secondary`, and so on) and is changed
 * together with it. Georgia stands in for Bitter, which no mail client has.
 */
const MAIL = {
  page: "#faf8f3",
  surface: "#ffffff",
  detail: "#efece4",
  border: "#dcd7cc",
  brand: "#004534",
  ink: "#003527",
  text: "#2e2e2e",
  muted: "#5b6360",
  onBrand: "#ffffff",
  font: "Georgia,'Times New Roman',serif",
} as const;

/** A "Termín: pondělí 3. srpna" line of a template, split at its first colon. */
interface DetailLine {
  label: string;
  value: string;
}

/*
 * A label is a word or two, so a sentence that merely contains a colon stays
 * prose. Letters, digits, spaces and hyphens only, which also keeps a link out
 * ("Více na https://navigym.cz" would otherwise read as a label).
 */
const DETAIL_LABEL = /^[\p{L}\d][\p{L}\d \-]{0,23}$/u;
/*
 * And a value is a value, not a sentence: template bodies are edited in the
 * administration, where "Upozornění: rezervace je nepřenosná a platí jen pro
 * uvedený termín." is prose an operator typed, not a row of a table. A value
 * therefore stays short and does not end a sentence. A leading slash pair is
 * what is left of a URL after the colon.
 */
const DETAIL_VALUE_MAX = 60;

function detailLine(line: string): DetailLine | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const label = line.slice(0, colon).trim();
  const value = line.slice(colon + 1).trim();
  if (
    !value ||
    value.length > DETAIL_VALUE_MAX ||
    /[.!?:]$/.test(value) ||
    value.startsWith("//") ||
    !DETAIL_LABEL.test(label)
  )
    return null;
  return { label, value };
}

/** The lines of one paragraph, when every one of them is a label and a value. */
function detailLines(paragraph: string): DetailLine[] | null {
  const lines = paragraph
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const parsed = lines.map(detailLine);
  return parsed.every((line): line is DetailLine => line !== null)
    ? parsed
    : null;
}

/**
 * The reservation detail of an e-mail: what the customer looks for first, so
 * it is a quiet table of labels and values rather than three lines of prose.
 */
function renderDetails(lines: DetailLine[]): string {
  const cell = (index: number) =>
    `padding:11px 16px;font-family:${MAIL.font};${index ? `border-top:1px solid ${MAIL.border};` : ""}`;
  const rows = lines
    .map(
      ({ label, value }, index) =>
        `<tr><td style="${cell(index)}font-size:14px;line-height:1.5;color:${MAIL.muted}">${escapeEmailHtml(label)}</td>` +
        `<td style="${cell(index)}font-size:15px;line-height:1.5;font-weight:bold;color:${MAIL.text}">${escapeEmailHtml(value)}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 20px;border:1px solid ${MAIL.border};background:${MAIL.detail};border-collapse:collapse">${rows}</table>`;
}

function renderParagraph(paragraph: string): string {
  return `<p style="margin:0 0 18px;font-family:${MAIL.font};font-size:16px;line-height:1.65;color:${MAIL.text}">${escapeEmailHtml(
    paragraph,
  ).replaceAll("\n", "<br />")}</p>`;
}

/**
 * The one action an authentication e-mail carries. A table around the anchor,
 * because Outlook ignores padding on an inline-block; the anchor itself keeps
 * the padding for every client that does honour it.
 */
function renderAction(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 10px;border-collapse:collapse"><tr><td align="center" style="background:${MAIL.brand};border-radius:4px"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:14px 26px;font-family:${MAIL.font};font-size:15px;font-weight:bold;line-height:1.2;color:${MAIL.onBrand};text-decoration:none">${escapeEmailHtml(label)}</a></td></tr></table>`;
}

/** One 600px column, centred, for both the card and the footer under it. */
function column(content: string, style = ""): string {
  const base = "width:100%;max-width:600px;border-collapse:collapse";
  return `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center" style="${style ? `${base};${style}` : base}">${content}</table>`;
}

/**
 * The branded shell around a template's plain text.
 *
 * Nested tables and inline styles on purpose: this is the markup every mail
 * client agrees on, and Outlook in particular has no grid, no flexbox and no
 * stylesheet. The text itself stays the source of truth : it is escaped, its
 * blank lines become paragraphs, and a paragraph whose every line reads
 * "label: value" becomes the detail table.
 */
export function emailTextToHtml(
  text: string,
  options?: { actionUrl?: string; actionLabel?: string },
): string {
  const body = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const details = detailLines(paragraph);
      return details ? renderDetails(details) : renderParagraph(paragraph);
    })
    .join("");
  const action =
    options?.actionUrl && options.actionLabel
      ? renderAction(options.actionUrl, options.actionLabel)
      : "";
  const card = column(
    `<tr><td style="height:4px;background:${MAIL.ink};font-size:1px;line-height:4px">&nbsp;</td></tr>` +
      `<tr><td align="center" style="padding:28px 28px 20px;border-bottom:1px solid ${MAIL.border}"><img src="${siteUrl(
        "/images/navi-logo-email.png",
      )}" alt="${EMAIL_BRAND}" width="150" style="display:block;width:150px;max-width:150px;height:auto;border:0;margin:0 auto" /></td></tr>` +
      `<tr><td style="padding:30px 28px 14px">${body}${action}</td></tr>`,
    `background:${MAIL.surface};border:1px solid ${MAIL.border}`,
  );
  /*
   * The footer carries the address and the no-reply line only. Every template
   * signs off in its own text, which is also the whole of the plain-text
   * alternative, so repeating the brand here would sign each e-mail twice.
   */
  const footer = column(
    `<tr><td align="center" style="padding:18px 12px 0;font-family:${MAIL.font};font-size:13px;line-height:1.6;color:${MAIL.muted}"><a href="${siteUrl(
      "/",
    )}" style="color:${MAIL.brand}">${siteHost()}</a><br />Tento e-mail byl odeslán automaticky. Na tuto adresu prosím neodpovídejte.</td></tr>`,
  );

  return `<div style="margin:0;background:${MAIL.page};padding:32px 16px;font-family:${MAIL.font};color:${MAIL.text}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse"><tr><td align="center">${card}${footer}</td></tr></table></div>`;
}
