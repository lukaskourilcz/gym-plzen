import { z } from "zod";

export const NOTICE_IDS = ["cancellation", "reschedule", "cookies"] as const;
export type NoticeId = (typeof NOTICE_IDS)[number];
export type NoticeFields = Record<string, string>;
export type PublicNotices = Record<NoticeId, NoticeFields>;
export const NOTICE_CACHE_TAG = "public-notices";
export const noticeSettingKey = (id: NoticeId) => `content.notice.${id}`;
type Field = {
  key: string;
  label: string;
  value: string;
  required?: readonly string[];
  button?: boolean;
};
type Definition = {
  id: NoticeId;
  label: string;
  description: string;
  variables: readonly string[];
  fields: readonly Field[];
};
const field = (
  key: string,
  label: string,
  value: string,
  required: readonly string[] = [],
): Field => ({ key, label, value, required });
const button = (key: string, label: string, value: string): Field => ({
  key,
  label,
  value,
  button: true,
});

export const NOTICE_DEFINITIONS: readonly Definition[] = [
  {
    id: "cancellation",
    label: "Zrušení rezervace",
    description:
      "Potvrzení zrušení jednoho termínu v zákaznickém účtu i ukázkovém náhledu.",
    variables: ["time", "price", "refund_note"],
    fields: [
      field("title", "Nadpis", "Zrušit tuto rezervaci?"),
      field(
        "body",
        "Vysvětlení storna",
        "Rezervace přestane platit a termín se po ověřeném odebrání vstupního kódu uvolní pro ostatní. Původní kód už nepoužívejte.",
      ),
      field("refund", "Informace o vrácení platby", "{refund_note}", [
        "refund_note",
      ]),
      field(
        "scope",
        "Ostatní termíny objednávky",
        "Zrušíte pouze tento termín. Ostatní rezervace z objednávky zůstanou platné.",
      ),
      field(
        "delivery",
        "Potvrzení e-mailem",
        "Potvrzení storna pošleme e-mailem.",
      ),
      field(
        "cutoff",
        "Méně než 24 hodin před začátkem",
        "Do začátku zbývá méně než 24 hodin. Změna termínu už není možná.",
      ),
      button("alternative", "Tlačítko změny termínu", "Raději změnit termín"),
      button("keep", "Tlačítko ponechání rezervace", "Ponechat rezervaci"),
      button(
        "confirmPaid",
        "Tlačítko placeného storna",
        "Ano, zrušit bez vrácení platby",
      ),
      button(
        "confirmFree",
        "Tlačítko bezplatného storna",
        "Ano, zrušit rezervaci",
      ),
    ],
  },
  {
    id: "reschedule",
    label: "Změna termínu",
    description:
      "Dialog ukázkové změny a potvrzení změny termínu ve skutečném zákaznickém účtu.",
    variables: ["time", "price"],
    fields: [
      field("title", "Nadpis", "Změnit termín"),
      field("original", "Původní termín", "Současný termín: {time}", ["time"]),
      field(
        "body",
        "Vysvětlení změny",
        "Vyberte nový den a čas. Změní se pouze tato rezervace; její cena zůstane stejná. Původní termín platí až do potvrzení změny.",
      ),
      field("date", "Popisek data", "Nové datum"),
      field(
        "empty",
        "Den bez volného termínu",
        "Pro tento den není volný termín. Vyberte jiné datum.",
      ),
      field(
        "selection",
        "Vybraný nový termín a cena",
        "Nový termín: {time}\nCena zůstává {price}.",
        ["time", "price"],
      ),
      field("confirmation", "Nadpis potvrzení", "Potvrzení změny"),
      field("oldLabel", "Popisek původního termínu", "Původní"),
      field("newLabel", "Popisek nového termínu", "Nový"),
      field(
        "note",
        "Informace po potvrzení",
        "Potvrzením se nový termín obsadí a původní se uvolní. Tuto změnu už nebude možné opakovat.",
      ),
      button("keep", "Tlačítko ponechání termínu", "Ponechat původní termín"),
      button("confirm", "Tlačítko potvrzení změny", "Potvrdit změnu termínu"),
    ],
  },
  {
    id: "cookies",
    label: "Nastavení soukromí (cookies)",
    description:
      "Panel při první návštěvě a po otevření nastavení cookies v patičce. Upravují se pouze texty, nikoli souhlasy.",
    variables: [],
    fields: [
      field("title", "Nadpis", "Nastavení soukromí"),
      field(
        "body",
        "Vysvětlení měření",
        "Volitelné měření spustíme jen podle vaší volby. Nastavení můžete kdykoliv změnit v patičce. Podrobnosti najdete v",
      ),
      field("privacyLink", "Odkaz na ochranu soukromí", "ochraně soukromí"),
      field("categories", "Název skupiny voleb", "Volitelné kategorie měření"),
      field("analyticsTitle", "Název analytiky", "Analytika"),
      field(
        "analyticsBody",
        "Popis analytiky",
        "Google Analytics nám pomáhá chápat návštěvnost a používání webu.",
      ),
      field("marketingTitle", "Název marketingu", "Marketing"),
      field(
        "marketingBody",
        "Popis marketingu",
        "Meta Pixel měří výkon reklam na Facebooku a Instagramu.",
      ),
      button("reject", "Tlačítko odmítnutí", "Pouze nezbytné"),
      button("save", "Tlačítko uložení volby", "Uložit volbu"),
      button("accept", "Tlačítko povolení všeho", "Povolit vše"),
    ],
  },
];
export const noticeDefinition = (id: NoticeId) =>
  NOTICE_DEFINITIONS.find((d) => d.id === id)!;
export function defaultPublicNotices(): PublicNotices {
  return Object.fromEntries(
    NOTICE_DEFINITIONS.map((d) => [
      d.id,
      Object.fromEntries(d.fields.map((f) => [f.key, f.value])),
    ]),
  ) as PublicNotices;
}
function fieldError(f: Field, value: unknown, allowed: readonly string[]) {
  if (typeof value !== "string" || !value.trim())
    return "Text nemůže být prázdný.";
  if (value.length > (f.button ? 100 : 3000)) return "Text je příliš dlouhý.";
  if (f.required?.some((token) => !value.includes(`{${token}}`)))
    return `Zachovejte značky ${f.required.map((t) => `{${t}}`).join(", ")}. Hodnoty doplňuje systém.`;
  if (
    [...value.matchAll(/\{([a-z_]+)\}/g)].some(
      (match) => !allowed.includes(match[1]!),
    )
  )
    return "Text obsahuje neznámou značku v závorkách.";
  return null;
}
export function parseNoticeFields(id: NoticeId, raw: unknown): NoticeFields {
  const stored =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as NoticeFields)
      : {};
  const def = noticeDefinition(id);
  return Object.fromEntries(
    def.fields.map((f) => [
      f.key,
      fieldError(f, stored[f.key], def.variables)
        ? f.value
        : stored[f.key]!.trim(),
    ]),
  );
}
export const saveNoticeSchema = z
  .object({ id: z.enum(NOTICE_IDS), fields: z.record(z.string().trim()) })
  .superRefine((input, ctx) => {
    const def = noticeDefinition(input.id);
    for (const key of Object.keys(input.fields))
      if (!def.fields.some((f) => f.key === key))
        ctx.addIssue({
          code: "custom",
          path: ["fields", key],
          message: "Tento text nelze upravit.",
        });
    for (const f of def.fields) {
      const message = fieldError(f, input.fields[f.key], def.variables);
      if (message)
        ctx.addIssue({ code: "custom", path: ["fields", f.key], message });
    }
  });
/** Plain text replacement only; replacements are not parsed again or treated as HTML. */
export function renderNotice(
  value: string,
  variables: Record<string, string> = {},
) {
  return value.replace(
    /\{([a-z_]+)\}/g,
    (token, key: string) => variables[key] ?? token,
  );
}
