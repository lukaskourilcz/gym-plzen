import { z } from "zod";

/** Stable diagnostic codes; client-facing sentences never depend on raw provider text. */
export const INCIDENTS = {
  contact_missing_all: {
    title: "Rezervace nemá kontaktní údaje",
    cause: "V kontaktu rezervace není jméno, e-mail ani telefon.",
    impact:
      "Vstupní kód není kam doručit e-mailem. Chybějící kontakt sám o sobě neznamená selhání vytvoření kódu.",
    action:
      "Otevřete rezervaci a ověřte skutečného zákazníka. Zákaznickou rezervaci předejte správci systému k doplnění doručovacího kontaktu. Pro vlastní obsazení prostoru používejte blokování termínů.",
    retryable: false,
  },
  contact_email_missing: {
    title: "Chybí e-mail pro doručení vstupního kódu",
    cause:
      "Kontakt rezervace neobsahuje doručovací e-mail. Telefon ani účet člena nenahrazují povinné doručení e-mailem.",
    impact:
      "Příprava kódu může pokračovat, ale e-mail se vstupním kódem nelze odeslat.",
    action:
      "Ověřte adresu zákazníka a předejte rezervaci správci systému k doplnění doručovacího e-mailu. E-mail v profilu člena se do starší rezervace automaticky nepřepisuje.",
    retryable: false,
  },
  lock_offline: {
    title: "Zámek je nedostupný — kód není potvrzený",
    cause: "Při kontrole Nuki nebylo možné ověřit dostupnost zámku.",
    impact:
      "Správný kód a jeho platnost zatím nejsou potvrzené. Systém kvůli tomu nevytváří další odlišný kód.",
    action:
      "Zkontrolujte připojení a stav zámku v Nuki. Systém bude bezpečně ověřovat stejný kód znovu.",
    retryable: true,
  },
  lock_rejected: {
    title: "Nuki odmítlo nastavení vstupního kódu",
    cause: "Nuki výslovně odmítlo požadavek na nastavení kódu.",
    impact: "Vstup tímto kódem zatím není potvrzený.",
    action:
      "Zkontrolujte zařízení a oprávnění v Nuki. Pokud odmítání trvá, předejte incident správci systému.",
    retryable: true,
  },
  code_unconfirmed: {
    title: "Zámek zatím nepotvrdil vstupní kód",
    cause:
      "Systém zatím neověřil správný kód a jeho časovou platnost na zámku.",
    impact:
      "Kód může na zámku existovat, ale jeho stav není bezpečně potvrzený. Další odlišný kód se nevytváří.",
    action:
      "Zkontrolujte stav Nuki. Nevytvářejte náhradní kód naslepo; opakování ověřuje původní požadavek.",
    retryable: true,
  },
  code_configuration_missing: {
    title: "Přípravu vstupního kódu blokuje nastavení systému",
    cause:
      "Chybí potřebné nastavení pro přípravu nebo bezpečné uložení vstupního kódu.",
    impact: "Systém nemůže dokončit přípravu kódu.",
    action:
      "Předejte incident správci systému ke kontrole nastavení Nuki a šifrování. Do poznámek nevkládejte tokeny ani PINy.",
    retryable: false,
  },
  code_preparation_failed: {
    title: "Přípravu vstupního kódu se nepodařilo dokončit",
    cause:
      "Příprava nebo kontrola vstupního kódu skončila chybou, jejíž přesná příčina zatím není potvrzená.",
    impact: "Funkční vstupní kód zatím není potvrzený.",
    action:
      "Otevřete rezervaci a předejte technické podrobnosti správci systému. Chybu nelze bez dalšího připsat chybějícímu kontaktu.",
    retryable: true,
  },
  email_configuration_missing: {
    title: "Odesílání e-mailů není nastavené",
    cause: "Systém nemá potřebné nastavení e-mailové služby.",
    impact:
      "Povinný e-mail nelze odeslat. To samo o sobě neznamená problém s vytvořením vstupního kódu.",
    action:
      "Předejte incident správci systému ke kontrole nastavení e-mailové služby.",
    retryable: false,
  },
  email_rate_limited: {
    title: "E-mailová služba dočasně omezuje odesílání",
    cause: "Poskytovatel vrátil omezení počtu požadavků (HTTP 429).",
    impact: "Přijetí povinného e-mailu k odeslání zatím není potvrzené.",
    action:
      "Systém požadavek zopakuje se stejným identifikátorem. Pokud omezení trvá, správce zkontroluje limity služby.",
    retryable: true,
  },
  email_unavailable: {
    title: "E-mailová služba je dočasně nedostupná",
    cause: "Poskytovatel e-mailu vrátil chybu své služby (HTTP 5xx).",
    impact: "Přijetí povinného e-mailu k odeslání zatím není potvrzené.",
    action:
      "Systém požadavek bezpečně zopakuje. Při delším výpadku kontaktujte správce systému.",
    retryable: true,
  },
  email_rejected: {
    title: "E-mailová služba odmítla odeslání zprávy",
    cause:
      "Poskytovatel e-mailu výslovně odmítl požadavek. Samotný stav HTTP neprokazuje, že zákazník zadal špatný e-mail.",
    impact: "Povinný e-mail nebyl přijat k odeslání.",
    action:
      "V Odeslaných zprávách ověřte důvod odmítnutí a předejte incident správci ke kontrole adresy, oprávnění a nastavení odesílatele.",
    retryable: false,
  },
  email_unconfirmed: {
    title: "Odeslání e-mailu není potvrzené",
    cause: "Odpověď e-mailové služby chybí nebo nepotvrdila přijetí zprávy.",
    impact:
      "Zpráva mohla být přijata. Systém používá stejný identifikátor odeslání, aby zabránil duplicitám.",
    action:
      "Zkontrolujte Odeslané zprávy. Ruční opakované odeslání může vytvořit duplicitu; další běžný pokus ověří původní odeslání.",
    retryable: true,
  },
  email_delivery_failed: {
    title: "Povinný e-mail se nepodařilo odeslat",
    cause:
      "Odeslání povinného e-mailu selhalo; přesný důvod zatím není zaznamenaný.",
    impact:
      "Doručení povinné zprávy není potvrzené. Nejde o důkaz, že se nepodařilo vytvořit vstupní kód.",
    action:
      "Otevřete konkrétní rezervaci a související zprávy. Podle jejich stavu ověřte kontakt zákazníka nebo e-mailovou službu.",
    retryable: true,
  },
} as const;
export type IncidentCode = keyof typeof INCIDENTS;
export type PipelineFailure = { code: IncidentCode; detail?: string };
export type IncidentStep = "payment" | "code_created" | "code_delivered";
export const INCIDENT_PHASES: Record<IncidentStep, string> = {
  payment: "Potvrzení rezervace",
  code_created: "Příprava vstupního kódu",
  code_delivered: "Doručení vstupního kódu",
};
export const incidentContextSchema = z.object({
  version: z.literal(1),
  code: z.custom<IncidentCode>(
    (value) => typeof value === "string" && Object.hasOwn(INCIDENTS, value),
  ),
  reservationId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  customerName: z.string().max(120).nullable(),
  step: z.enum(["payment", "code_created", "code_delivered"]),
  attempts: z.number().int().nonnegative(),
  nextRetryAt: z.string().datetime().nullable(),
  technicalDetail: z.string().max(500).nullable(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  occurrences: z.number().int().positive(),
});
export type IncidentContext = z.infer<typeof incidentContextSchema>;
export function parseIncident(context: unknown): IncidentContext | null {
  if (!context || typeof context !== "object" || !("incident" in context))
    return null;
  const result = incidentContextSchema.safeParse(context.incident);
  return result.success ? result.data : null;
}
export function contactFailure(contact: {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  userId?: string | null;
}): PipelineFailure | null {
  if (!contact.contactEmail?.trim())
    return {
      code:
        !contact.contactName?.trim() &&
        !contact.contactPhone?.trim() &&
        !contact.userId
          ? "contact_missing_all"
          : "contact_email_missing",
    };
  return null;
}
export function emailFailure(reason?: string | null): PipelineFailure {
  const code: IncidentCode =
    reason === "resend_not_configured"
      ? "email_configuration_missing"
      : reason === "resend_http_429"
        ? "email_rate_limited"
        : /^resend_http_5\d\d$/.test(reason ?? "")
          ? "email_unavailable"
          : /^resend_http_4\d\d$/.test(reason ?? "")
            ? "email_rejected"
            : [
                  "resend_network_unconfirmed",
                  "resend_send_unconfirmed_no_message_id",
                ].includes(reason ?? "")
              ? "email_unconfirmed"
              : "email_delivery_failed";
  return { code, detail: reason ?? undefined };
}
export function preparationFailure(
  reason?: string | null,
  detail?: string,
): PipelineFailure {
  return {
    code:
      detail?.includes("Missing required environment") ||
      detail?.includes("ACCESS_CODE_ENCRYPTION_KEY") ||
      detail?.includes("NUKI_SMARTLOCK_ID") ||
      detail?.includes("NUKI_API_TOKEN")
        ? "code_configuration_missing"
        : reason === "device_offline"
          ? "lock_offline"
          : reason === "provider_rejected"
            ? "lock_rejected"
            : ["awaiting_device", "provisioning_unknown"].includes(reason ?? "")
              ? "code_unconfirmed"
              : "code_preparation_failed",
    detail: detail ?? reason ?? undefined,
  };
}
export function contactIncidentKey(id: string) {
  return `reservation:${id}:contact`;
}
export function isContactFailure(code: IncidentCode) {
  return code.startsWith("contact_");
}
