import { z } from "zod";
import { HttpError } from "./http";

export const NUKI_HEALTH_IMPACT =
  "Nové kódy mohou čekat na potvrzení; jejich připravenost ověřte u nejbližších rezervací. Již ověřené kódy nejsou tímto hlášením označené za nefunkční.";
export const NUKI_STATUS_URL = "https://status.nuki.io";
export const NUKI_HEALTH_DESCRIPTIONS = {
  online: {
    title: "Nuki potvrzuje spojení se zámkem",
    cause: "Nuki API potvrdilo, že je zámek připojený.",
    action: "Stav konkrétních vstupních kódů ověřujte u rezervací.",
  },
  lock_offline: {
    title: "Nuki hlásí odpojený zámek",
    cause:
      "Nuki API odpovědělo a hlásí zámek offline. To samo neprokazuje poruchu zámku; může jít o jeho napájení nebo připojení.",
    action: "Zkontrolujte napájení, Wi-Fi a připojení zámku v aplikaci Nuki.",
  },
  service_incident: {
    title: "Nuki Web/API hlásí incident služby",
    cause:
      "Veřejný stav Nuki hlásí omezení služby pro Web, REST API nebo vzdálený přístup. Dopad na konkrétní zámek nelze určit jen z veřejného stavu.",
    action:
      "Sledujte stav služby Nuki. Samotný incident služby není důvodem k restartu zámku.",
  },
  api_unavailable: {
    title: "Nuki Web/API vrací chybu služby",
    cause:
      "Nuki API vrátilo serverovou chybu HTTP 5xx. Dostupnost zámku tím není ověřená.",
    action: "Vyčkejte na další kontrolu a ověřte stav služby Nuki.",
  },
  access_denied: {
    title: "Přístup systému k Nuki Web/API není platný",
    cause:
      "Nuki API odmítlo přístup nebo nenalezlo nastavený zámek (HTTP 401, 403 nebo 404). Nejde o potvrzenou poruchu zámku.",
    action:
      "Správce systému musí ověřit token, jeho oprávnění a ID zámku v nastavení integrace.",
  },
  rate_limited: {
    title: "Nuki Web/API omezuje počet požadavků",
    cause:
      "Nuki API vrátilo omezení počtu požadavků (HTTP 429). Dostupnost zámku tím není ověřená.",
    action:
      "Vyčkejte na další kontrolu; správce ověří využití limitu Nuki API.",
  },
  connection_unknown: {
    title: "Spojení s Nuki Web/API se nepodařilo ověřit",
    cause:
      "Požadavek na Nuki API nedostal použitelnou odpověď. Příčina může být v připojení systému nebo službě Nuki; stav zámku není známý.",
    action:
      "Ověřte stav služby Nuki a připojení systému. Z této chyby nelze určit poruchu zámku.",
  },
  state_unknown: {
    title: "Nuki nepotvrdilo stav připojení zámku",
    cause:
      "Odpověď Nuki API nepotvrdila připojený ani odpojený zámek. Přesná příčina zatím není známá.",
    action: "Správce ověří odpověď Nuki API a stav zařízení v aplikaci Nuki.",
  },
} as const;

const diagnosisSchema = z.object({
  code: z.enum(
    Object.keys(NUKI_HEALTH_DESCRIPTIONS) as [
      keyof typeof NUKI_HEALTH_DESCRIPTIONS,
      ...(keyof typeof NUKI_HEALTH_DESCRIPTIONS)[],
    ],
  ),
  lockState: z.enum(["online", "offline", "unknown"]),
  apiHttpStatus: z.number().int().min(100).max(599).nullable(),
  serviceStatus: z.enum(["operational", "incident", "unknown"]),
  affectedServices: z
    .array(z.enum(["Nuki Web", "Nuki REST API", "Nuki Remote Access"]))
    .max(3),
});
export type NukiDiagnosis = z.infer<typeof diagnosisSchema>;
export type NukiApiObservation = {
  state: NukiDiagnosis["lockState"];
  failure:
    | "access_denied"
    | "rate_limited"
    | "unavailable"
    | "network"
    | "invalid_response"
    | null;
  httpStatus: number | null;
};
export type NukiServiceObservation = Pick<
  NukiDiagnosis,
  "serviceStatus" | "affectedServices"
>;

/** Do not persist provider payloads, request URLs or credentials in diagnostics. */
export function nukiApiFailure(error: unknown): NukiApiObservation {
  const status = error instanceof HttpError ? error.status : null;
  return {
    state: "unknown",
    httpStatus: status,
    failure:
      status === 401 || status === 403 || status === 404
        ? "access_denied"
        : status === 429
          ? "rate_limited"
          : status != null && status >= 500 && status <= 599
            ? "unavailable"
            : status == null
              ? "network"
              : "invalid_response",
  };
}

export function diagnoseNuki(
  api: NukiApiObservation,
  service: NukiServiceObservation,
): NukiDiagnosis {
  const code: NukiDiagnosis["code"] =
    api.failure === "access_denied"
      ? "access_denied"
      : api.failure === "rate_limited"
        ? "rate_limited"
        : service.serviceStatus === "incident"
          ? "service_incident"
          : api.failure === "unavailable"
            ? "api_unavailable"
            : api.failure === "network"
              ? "connection_unknown"
              : api.state === "offline"
                ? "lock_offline"
                : api.state === "online"
                  ? "online"
                  : "state_unknown";
  return {
    code,
    lockState: api.state,
    apiHttpStatus: api.httpStatus,
    ...service,
  };
}

export function parseNukiDiagnosis(context: unknown): NukiDiagnosis | null {
  if (!context || typeof context !== "object" || !("nukiDiagnosis" in context))
    return null;
  const result = diagnosisSchema.safeParse(context.nukiDiagnosis);
  return result.success ? result.data : null;
}

export function describeNukiDiagnosis(diagnosis: NukiDiagnosis) {
  const description = NUKI_HEALTH_DESCRIPTIONS[diagnosis.code];
  const lock = {
    online: "připojený podle Nuki API",
    offline: "odpojený podle Nuki API",
    unknown: "neověřený",
  }[diagnosis.lockState];
  const service =
    diagnosis.serviceStatus === "incident"
      ? `omezení: ${diagnosis.affectedServices.join(", ")}`
      : diagnosis.serviceStatus === "operational"
        ? "bez zveřejněného incidentu (nevylučuje místní problém)"
        : "veřejný stav se nepodařilo ověřit";
  const evidence = [
    `Zámek: ${lock}.`,
    `Služba Nuki: ${service}.`,
    diagnosis.apiHttpStatus
      ? `Odpověď Nuki API: HTTP ${diagnosis.apiHttpStatus}.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    ...description,
    evidence,
    body: [
      description.cause,
      evidence,
      `Co udělat: ${description.action}`,
      NUKI_HEALTH_IMPACT,
      `Stav služby: ${NUKI_STATUS_URL}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
